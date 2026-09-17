"""
AI Advisory Layer
==================
Implements a two-tier advisory system:

Tier 1 — Rule-based engine
  Checks severity, zone type, and repeated reports to generate initial
  recommendations without any external API calls.

Tier 2 — LLM advisory (optional)
  If OPENAI_API_KEY is set, supplements the rule-based recommendation with
  an LLM-generated advisory. The LLM output is clearly labelled and must
  not be interpreted as a confirmed or executed action.

IMPORTANT: The AI layer never claims an action has been performed.
           It only produces recommendations for authority review.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class AdvisoryInput:
    report_id: int
    title: str
    description: str
    severity: str
    zone_name: Optional[str]
    site_name: str
    open_reports_in_zone: int = 0


@dataclass
class AdvisoryOutput:
    recommendation: str
    reasoning_summary: str
    recommended_action: str
    priority: str
    generated_by: str


# ---------------------------------------------------------------------------
# Rule-based engine
# ---------------------------------------------------------------------------

SEVERITY_PRIORITY_MAP = {
    'critical': 'urgent',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
}

RULE_TEMPLATES = {
    'critical': (
        "CRITICAL contamination event reported in {zone} at site {site}. "
        "Immediate isolation and investigation required.",
        "Severity is CRITICAL. Escalation is mandatory under site safety protocol.",
        "Isolate affected zone immediately. Notify site safety officer. "
        "Collect water samples for laboratory analysis. Do not restore flow until cleared."
    ),
    'high': (
        "High-severity contamination reported in {zone} at site {site}. "
        "Urgent investigation recommended.",
        "Severity is HIGH. Potential impact on downstream sinks and water reuse network.",
        "Inspect the reported zone within 2 hours. Collect samples. "
        "Consider temporarily rerouting affected flows."
    ),
    'medium': (
        "Medium-severity water quality concern in {zone} at site {site}.",
        "Repeated or unresolved medium-severity reports may warrant escalation.",
        "Schedule inspection within 24 hours. Review water quality logs for the zone. "
        "Consider treatment adjustment if flows are impacted."
    ),
    'low': (
        "Low-severity observation in {zone} at site {site}.",
        "Low severity. No immediate action required but should be logged.",
        "Monitor the reported area. If the issue recurs, escalate to medium severity."
    ),
}


def run_rule_based(inp: AdvisoryInput) -> AdvisoryOutput:
    sev = inp.severity.lower()
    zone = inp.zone_name or 'Unknown Zone'
    site = inp.site_name

    template = RULE_TEMPLATES.get(sev, RULE_TEMPLATES['low'])
    rec = template[0].format(zone=zone, site=site)
    reason = template[1]
    action = template[2]

    if inp.open_reports_in_zone >= 3:
        reason += (
            f" Note: There are {inp.open_reports_in_zone} open reports in this zone, "
            "suggesting a recurring or systemic issue."
        )
        action += " Conduct a comprehensive zone audit given the pattern of reports."

    priority = SEVERITY_PRIORITY_MAP.get(sev, 'medium')

    return AdvisoryOutput(
        recommendation=rec,
        reasoning_summary=reason,
        recommended_action=action,
        priority=priority,
        generated_by='rule-based',
    )


# ---------------------------------------------------------------------------
# LLM advisory (optional — requires OPENAI_API_KEY)
# ---------------------------------------------------------------------------

def run_llm_advisory(inp: AdvisoryInput, rule_output: AdvisoryOutput) -> AdvisoryOutput:
    """
    Attempt to enrich the rule-based recommendation with an LLM advisory.
    Falls back to rule-based output if the API is unavailable.
    The LLM output is labelled 'llm+rule-based'.
    """
    try:
        from django.conf import settings
        import openai

        api_key = getattr(settings, 'OPENAI_API_KEY', '')
        if not api_key:
            return rule_output

        client = openai.OpenAI(api_key=api_key)

        prompt = (
            f"You are an industrial water-quality advisory assistant.\n"
            f"A contamination report has been submitted:\n"
            f"- Site: {inp.site_name}\n"
            f"- Zone: {inp.zone_name or 'Unknown'}\n"
            f"- Severity: {inp.severity}\n"
            f"- Title: {inp.title}\n"
            f"- Description: {inp.description}\n\n"
            f"Rule-based recommendation:\n{rule_output.recommendation}\n\n"
            f"Rule-based action:\n{rule_output.recommended_action}\n\n"
            f"Please provide a concise supplementary advisory (≤ 3 sentences) that may "
            f"add context or refine the action steps. Do NOT claim that any action has "
            f"been taken. This is an advisory only."
        )

        response = client.chat.completions.create(
            model='gpt-3.5-turbo',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=200,
            temperature=0.3,
        )

        llm_text = response.choices[0].message.content.strip()
        combined_action = rule_output.recommended_action + f"\n\n[LLM Advisory] {llm_text}"

        return AdvisoryOutput(
            recommendation=rule_output.recommendation,
            reasoning_summary=rule_output.reasoning_summary + " [LLM-supplemented]",
            recommended_action=combined_action,
            priority=rule_output.priority,
            generated_by='llm+rule-based',
        )

    except Exception as exc:
        logger.warning(f"LLM advisory failed, falling back to rule-based: {exc}")
        return rule_output


def generate_advisory(inp: AdvisoryInput) -> AdvisoryOutput:
    """Entry point: always runs rule-based, optionally supplements with LLM."""
    rule_out = run_rule_based(inp)
    return run_llm_advisory(inp, rule_out)
