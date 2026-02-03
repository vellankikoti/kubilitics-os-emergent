package service

import (
	"context"
	"fmt"

	"github.com/kubilitics/kubilitics-backend/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EventsService provides access to Kubernetes events
type EventsService interface {
	ListEvents(ctx context.Context, clusterID, namespace string, limit int) ([]*models.Event, error)
	GetResourceEvents(ctx context.Context, clusterID, namespace, resourceKind, resourceName string) ([]*models.Event, error)
	WatchEvents(ctx context.Context, clusterID, namespace string, eventChan chan<- *models.Event, errChan chan<- error)
}

type eventsService struct {
	clusterService *clusterService
}

// NewEventsService creates a new events service
func NewEventsService(cs ClusterService) EventsService {
	return &eventsService{
		clusterService: cs.(*clusterService),
	}
}

func (s *eventsService) ListEvents(ctx context.Context, clusterID, namespace string, limit int) ([]*models.Event, error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	listOpts := metav1.ListOptions{}
	if limit > 0 {
		listOpts.Limit = int64(limit)
	}

	eventList, err := client.Clientset.CoreV1().Events(namespace).List(ctx, listOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to list events: %w", err)
	}

	events := make([]*models.Event, 0, len(eventList.Items))
	for _, event := range eventList.Items {
		events = append(events, &models.Event{
			ID:             string(event.UID),
			Type:           event.Type,
			Reason:         event.Reason,
			Message:        event.Message,
			ResourceKind:   event.InvolvedObject.Kind,
			ResourceName:   event.InvolvedObject.Name,
			Namespace:      event.InvolvedObject.Namespace,
			FirstTimestamp: event.FirstTimestamp.Time,
			LastTimestamp:  event.LastTimestamp.Time,
			Count:          event.Count,
		})
	}

	return events, nil
}

func (s *eventsService) GetResourceEvents(ctx context.Context, clusterID, namespace, resourceKind, resourceName string) ([]*models.Event, error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	fieldSelector := fmt.Sprintf("involvedObject.kind=%s,involvedObject.name=%s", resourceKind, resourceName)
	listOpts := metav1.ListOptions{
		FieldSelector: fieldSelector,
	}

	eventList, err := client.Clientset.CoreV1().Events(namespace).List(ctx, listOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to list resource events: %w", err)
	}

	events := make([]*models.Event, 0, len(eventList.Items))
	for _, event := range eventList.Items {
		events = append(events, &models.Event{
			ID:             string(event.UID),
			Type:           event.Type,
			Reason:         event.Reason,
			Message:        event.Message,
			ResourceKind:   event.InvolvedObject.Kind,
			ResourceName:   event.InvolvedObject.Name,
			Namespace:      event.InvolvedObject.Namespace,
			FirstTimestamp: event.FirstTimestamp.Time,
			LastTimestamp:  event.LastTimestamp.Time,
			Count:          event.Count,
		})
	}

	return events, nil
}

func (s *eventsService) WatchEvents(ctx context.Context, clusterID, namespace string, eventChan chan<- *models.Event, errChan chan<- error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		errChan <- err
		return
	}

	watcher, err := client.Clientset.CoreV1().Events(namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		errChan <- fmt.Errorf("failed to watch events: %w", err)
		return
	}
	defer watcher.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-watcher.ResultChan():
			if !ok {
				return
			}

			if k8sEvent, ok := event.Object.(*corev1.Event); ok {
				eventChan <- &models.Event{
					ID:             string(k8sEvent.UID),
					Type:           k8sEvent.Type,
					Reason:         k8sEvent.Reason,
					Message:        k8sEvent.Message,
					ResourceKind:   k8sEvent.InvolvedObject.Kind,
					ResourceName:   k8sEvent.InvolvedObject.Name,
					Namespace:      k8sEvent.InvolvedObject.Namespace,
					FirstTimestamp: k8sEvent.FirstTimestamp.Time,
					LastTimestamp:  k8sEvent.LastTimestamp.Time,
					Count:          k8sEvent.Count,
				}
			}
		}
	}
}
