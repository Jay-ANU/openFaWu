from __future__ import annotations

import logging

from config import celery_app
from opencontractserver.legal_workspace.models import ReviewRun
from opencontractserver.legal_workspace.services.review_engine import (
    DocumentProcessingFailed,
    DocumentTextNotReady,
    mark_review_failed,
    mark_waiting_for_document,
    run_contract_review,
)

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=40, default_retry_delay=15)
def run_contract_review_task(self, review_run_id: int) -> int:
    try:
        review_run = run_contract_review(review_run_id)
        return review_run.id
    except DocumentTextNotReady as exc:
        review_run = ReviewRun.objects.get(pk=review_run_id)
        mark_waiting_for_document(review_run, str(exc))
        raise self.retry(exc=exc)
    except DocumentProcessingFailed as exc:
        review_run = ReviewRun.objects.get(pk=review_run_id)
        mark_review_failed(review_run, str(exc))
        return review_run.id
    except Exception as exc:
        logger.exception("Contract review %s failed", review_run_id)
        review_run = ReviewRun.objects.filter(pk=review_run_id).first()
        if review_run is not None:
            mark_review_failed(review_run, str(exc))
        raise
