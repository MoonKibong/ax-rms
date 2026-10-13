.PHONY: build test lint screenshots

build:
	./backend/mvnw -f backend/pom.xml package
	npm --prefix frontend run build

test:
	./backend/mvnw -f backend/pom.xml test
	npm --prefix frontend run test
	npm --prefix frontend run test:e2e

lint:
	./backend/mvnw -f backend/pom.xml checkstyle:check
	npm --prefix frontend run lint

screenshots:
	@if [ -z "$(T)" ]; then echo "screenshots: T가 필요합니다 (예: make screenshots T=4)" >&2; exit 2; fi
	@if [ ! -f "frontend/e2e/screens/T$(T).spec.ts" ]; then echo "screenshots: frontend/e2e/screens/T$(T).spec.ts 없음" >&2; exit 2; fi
	scripts/e2e-servers.sh -- npm --prefix frontend run screenshots -- e2e/screens/T$(T).spec.ts
