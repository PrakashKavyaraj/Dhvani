"""
Prometheus Metrics API Endpoint for Dhvani.
"""

from fastapi import APIRouter, Response
from app.services.metrics_service import metrics_service

router = APIRouter(tags=["Observability & Metrics"])


@router.get("/metrics")
def get_prometheus_metrics():
    """
    Standard OpenMetrics / Prometheus scraper endpoint.
    Exposes sub-350ms SLA histograms, telephony throughput, and SASV verdict counters.
    """
    content = metrics_service.export_metrics_text()
    return Response(
        content=content,
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
