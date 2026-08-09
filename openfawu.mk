SHELL := /bin/bash

.PHONY: solo-init solo-up solo-down solo-logs solo-backup solo-restore solo-check

solo-init:
	./scripts/openfawu/solo-init.sh

solo-up:
	./scripts/openfawu/solo-up.sh

solo-down:
	./scripts/openfawu/solo-down.sh

solo-logs:
	docker compose -f solo.yml logs -f --tail=200

solo-backup:
	./scripts/openfawu/solo-backup.sh

solo-restore:
	@test -n "$(FILE)" || (echo "用法: make -f openfawu.mk solo-restore FILE=backups/openfawu/<file>.sql.gz" && exit 1)
	./scripts/openfawu/solo-restore.sh "$(FILE)"

solo-check:
	python3 scripts/openfawu/validate_foundation.py
	docker compose -f solo.yml config --quiet
