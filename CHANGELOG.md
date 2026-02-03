# Changelog

All notable changes to Kubilitics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Foundation Phase - 2026-02-04

#### Added
- Initial project structure for backend, desktop, and mobile
- Go backend foundation with Kubernetes client integration
- Tauri desktop application scaffolding
- Tauri mobile application scaffolding
- Topology engine foundation with graph data structures
- REST API handlers for clusters and topology
- Data models for Cluster, Resource, Topology, Events
- Service layer (ClusterService, TopologyService)
- Configuration management with Viper
- Comprehensive documentation (README, ARCHITECTURE, TASKS)
- Contributing guidelines and security policy

#### Backend
- Kubernetes client-go v0.30.0 integration
- Resource discovery for core types (Pods, Deployments, Services, ReplicaSets, ConfigMaps, Secrets)
- Basic relationship inference (OwnerReferences, Label Selectors, Volume Mounts)
- Deterministic layout seed generation
- Graph validation (orphan edge detection)
- HTTP server with graceful shutdown
- CORS middleware
- Health check endpoint

#### Desktop
- Tauri 2.0 configuration
- Rust IPC commands (read_kubeconfig, get_app_data_dir)
- Sidecar process manager for Go backend
- Cross-platform build configuration
- File system access for kubeconfig

#### Mobile
- Tauri Mobile library setup
- API client for remote backend
- Commands for cluster connection and topology fetching

#### Documentation
- Comprehensive README with quick start
- Architecture deep-dive (topology engine, data flow)
- Complete task list with 200+ tasks
- Contributing guidelines
- Security policy

### In Progress
- [ ] Complete Kubernetes resource discovery (50+ types)
- [ ] Complete relationship inference (RBAC, Network, Autoscaling)
- [ ] WebSocket real-time layer
- [ ] Database persistence layer
- [ ] Export service (PNG, PDF, SVG)
- [ ] Desktop frontend integration
- [ ] Mobile native features (biometric auth, push notifications)
- [ ] Comprehensive testing suite

---

## [1.0.0] - TBD

### Planned Features

#### Backend
- Complete topology engine with all relationship types
- WebSocket real-time updates
- SQLite/PostgreSQL persistence
- Export service (PNG, PDF, SVG)
- Logs and metrics collection
- Events streaming

#### Desktop
- Full frontend integration
- Kubeconfig auto-detection
- Native menus and system tray
- Auto-updater
- Multi-cluster support

#### Mobile
- iOS app (App Store)
- Android app (Play Store)
- Offline mode with sync
- Biometric authentication
- Push notifications
- QR code connection

#### Testing
- 85%+ code coverage
- Integration tests with K8s
- E2E tests with Playwright
- Topology truth tests
- Performance benchmarks

#### Infrastructure
- CI/CD pipeline
- Automated releases
- Code signing
- App store submissions

---

## Version History

### Pre-1.0 (Foundation)
- 0.1.0 - Initial foundation (2026-02-04)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to Kubilitics.

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.
