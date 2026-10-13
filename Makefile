.PHONY: build test lint screenshots

build:
	./backend/mvnw -f backend/pom.xml package
	npm --prefix frontend run build

test:
	./backend/mvnw -f backend/pom.xml test
	npm --prefix frontend run test

lint:
	./backend/mvnw -f backend/pom.xml checkstyle:check
	npm --prefix frontend run lint

screenshots:
	@echo "screenshots: not set up yet (T=$(T))"; exit 1
