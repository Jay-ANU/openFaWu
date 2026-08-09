from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from opencontractserver.legal_workspace.enums import ReviewRunStatus, WorkspaceType
from opencontractserver.legal_workspace.models import LegalWorkspace, ReviewRun


class LegalWorkspaceModelTests(SimpleTestCase):
    def test_matter_flag_is_explicit(self):
        workspace = LegalWorkspace(workspace_type=WorkspaceType.MATTER)
        self.assertTrue(workspace.is_matter)
        workspace.workspace_type = WorkspaceType.AUTHORITY
        self.assertFalse(workspace.is_matter)


class ReviewRunTransitionTests(SimpleTestCase):
    def test_happy_path_transition_updates_stage(self):
        run = ReviewRun(status=ReviewRunStatus.PENDING)
        run.transition_to(ReviewRunStatus.PARSING)
        self.assertEqual(run.status, ReviewRunStatus.PARSING)
        self.assertEqual(run.current_stage, ReviewRunStatus.PARSING)
        self.assertIsNotNone(run.started_at)

    def test_illegal_transition_is_rejected(self):
        run = ReviewRun(status=ReviewRunStatus.PENDING)
        with self.assertRaises(ValidationError):
            run.transition_to(ReviewRunStatus.COMPLETED)
