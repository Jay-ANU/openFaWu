import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("legal_workspace", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="playbookrule",
            name="applicability",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="规则适用条件，例如合同类型、我方角色或审查背景标记。",
            ),
        ),
        migrations.AddField(
            model_name="playbookrule",
            name="blocking",
            field=models.BooleanField(
                default=False,
                help_text="命中后是否应阻断审查完成。",
            ),
        ),
        migrations.AddField(
            model_name="playbookrule",
            name="business_question",
            field=models.TextField(
                blank=True,
                default="",
                help_text="命中规则后需要业务补充确认的问题。",
            ),
        ),
        migrations.AddField(
            model_name="playbookrule",
            name="required_terms_mode",
            field=models.CharField(
                choices=[("all", "全部出现"), ("any", "至少出现一项")],
                default="all",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="ContractClause",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        db_index=True, default=django.utils.timezone.now
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "clause_type",
                    models.CharField(db_index=True, default="other", max_length=64),
                ),
                ("heading", models.CharField(max_length=512)),
                ("text", models.TextField()),
                ("source_start", models.PositiveIntegerField(default=0)),
                ("source_end", models.PositiveIntegerField(default=0)),
                ("page_number", models.PositiveIntegerField(blank=True, null=True)),
                ("sort_order", models.IntegerField(default=0)),
                ("confidence", models.FloatField(blank=True, null=True)),
                (
                    "review_run",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="clauses",
                        to="legal_workspace.reviewrun",
                    ),
                ),
            ],
            options={"ordering": ("sort_order", "id")},
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="business_impact",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="clause_title",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="fallback_position",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="required_confirmation",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="risk_type",
            field=models.CharField(db_index=True, default="playbook", max_length=64),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="rule_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="source_end",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="source_start",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="contractfinding",
            name="clause",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="findings",
                to="legal_workspace.contractclause",
            ),
        ),
        migrations.AddConstraint(
            model_name="contractclause",
            constraint=models.CheckConstraint(
                condition=models.Q(source_end__gte=models.F("source_start")),
                name="legal_clause_end_after_start",
            ),
        ),
        migrations.AddConstraint(
            model_name="contractclause",
            constraint=models.CheckConstraint(
                condition=models.Q(confidence__isnull=True)
                | (models.Q(confidence__gte=0.0) & models.Q(confidence__lte=1.0)),
                name="legal_clause_confidence_between_zero_and_one",
            ),
        ),
        migrations.AddIndex(
            model_name="contractclause",
            index=models.Index(
                fields=["review_run", "sort_order"],
                name="legal_clau_review__a14d7e_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="contractclause",
            index=models.Index(
                fields=["review_run", "clause_type"],
                name="legal_clau_review__584772_idx",
            ),
        ),
    ]
