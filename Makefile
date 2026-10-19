.PHONY: build test lint screenshots run reset-db

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
	scripts/e2e-servers.sh --fresh-db -- npm --prefix frontend run screenshots -- e2e/screens/T$(T).spec.ts

run:
	BACKEND_PORT="$${BACKEND_PORT:-8080}" FRONTEND_PORT="$${FRONTEND_PORT:-5173}" scripts/run.sh

reset-db:
	scripts/reset-db.sh --db "$${RESET_DB_PATH:-backend/data/app.db}" --port "$${BACKEND_PORT:-8080}"
