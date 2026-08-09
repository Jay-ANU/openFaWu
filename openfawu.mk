SHELL := /bin/bash

.PHONY: solo-init solo-up solo-down solo-logs solo-backup solo-restore solo-check codex-init codex-bridge codex-token codex-check

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


codex-init:
	./scripts/openfawu/codex-bridge-init.sh

codex-bridge:
	./scripts/openfawu/codex-bridge-up.sh

codex-token:
	@./scripts/openfawu/codex-bridge-token.sh

codex-check:
	python3 -m compileall -q openfawu_codex_bridge
	python3 -m unittest discover -s openfawu_codex_bridge/tests -v
