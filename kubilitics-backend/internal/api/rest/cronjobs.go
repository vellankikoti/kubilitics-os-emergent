package rest

import (
	"net/http"

	"github.com/gorilla/mux"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/kubilitics/kubilitics-backend/internal/pkg/audit"
	"github.com/kubilitics/kubilitics-backend/internal/pkg/logger"
	"github.com/kubilitics/kubilitics-backend/internal/pkg/validate"
)

// PostCronJobTrigger handles POST /clusters/{clusterId}/resources/cronjobs/{namespace}/{name}/trigger
// Creates a one-off Job from the CronJob's spec.jobTemplate.
func (h *Handler) PostCronJobTrigger(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["clusterId"]
	namespace := vars["namespace"]
	name := vars["name"]

	if !validate.ClusterID(clusterID) || !validate.Namespace(namespace) || !validate.Name(name) {
		respondError(w, http.StatusBadRequest, "Invalid clusterId, namespace, or name")
		return
	}

	resolvedID, err := h.resolveClusterID(r.Context(), clusterID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	client, err := h.clusterService.GetClient(resolvedID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	ctx := r.Context()
	requestID := logger.FromContext(r.Context())

	cronJob, err := client.GetResource(ctx, "cronjobs", namespace, name)
	if err != nil {
		audit.LogMutation(requestID, clusterID, "trigger", "cronjobs", namespace, name, "failure", err.Error())
		if apierrors.IsNotFound(err) {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	spec, _ := cronJob.Object["spec"].(map[string]interface{})
	if spec == nil {
		respondError(w, http.StatusBadRequest, "CronJob has no spec")
		return
	}
	jobTemplate, _ := spec["jobTemplate"].(map[string]interface{})
	if jobTemplate == nil {
		respondError(w, http.StatusBadRequest, "CronJob has no spec.jobTemplate")
		return
	}
	jobSpec, _ := jobTemplate["spec"].(map[string]interface{})
	if jobSpec == nil {
		respondError(w, http.StatusBadRequest, "CronJob jobTemplate has no spec")
		return
	}

	jobMeta, _ := jobTemplate["metadata"].(map[string]interface{})
	if jobMeta == nil {
		jobMeta = make(map[string]interface{})
	}

	// Build Job object: apiVersion batch/v1, kind Job, metadata.generateName = name-, namespace, labels/annotations; spec = jobTemplate.spec
	jobObj := map[string]interface{}{
		"apiVersion": "batch/v1",
		"kind":       "Job",
		"metadata": map[string]interface{}{
			"generateName": name + "-",
			"namespace":    namespace,
		},
		"spec": jobSpec,
	}
	meta := jobObj["metadata"].(map[string]interface{})
	if labels, ok := jobMeta["labels"].(map[string]interface{}); ok && len(labels) > 0 {
		meta["labels"] = labels
	}
	if ann, ok := jobMeta["annotations"].(map[string]interface{}); ok && len(ann) > 0 {
		meta["annotations"] = ann
	}

	jobUnstructured := &unstructured.Unstructured{Object: jobObj}
	created, err := client.CreateResource(ctx, jobUnstructured)
	if err != nil {
		audit.LogMutation(requestID, clusterID, "trigger", "cronjobs", namespace, name, "failure", err.Error())
		if apierrors.IsAlreadyExists(err) {
			respondError(w, http.StatusConflict, err.Error())
			return
		}
		if apierrors.IsForbidden(err) {
			respondError(w, http.StatusForbidden, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	audit.LogMutation(requestID, clusterID, "trigger", "cronjobs", namespace, name, "success", "")
	respondJSON(w, http.StatusCreated, created.Object)
}
