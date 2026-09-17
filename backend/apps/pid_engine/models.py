from django.db import models
from apps.sites.models import Site

class PIDDocument(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="pid_documents")
    file = models.FileField(upload_to='pid_documents/')
    page_count = models.IntegerField(default=1)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    processing_status = models.CharField(max_length=50, default="UPLOADED")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class PIDPage(models.Model):
    document = models.ForeignKey(PIDDocument, on_delete=models.CASCADE, related_name="pages")
    page_number = models.IntegerField(default=1)
    image_reference = models.FileField(upload_to='pid_pages/', null=True, blank=True)
    width = models.IntegerField()
    height = models.IntegerField()
    scale_metadata = models.JSONField(default=dict, blank=True)

class ProjectLegend(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="legends")
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=50, default="1.0")
    symbol_rules = models.JSONField(default=list, blank=True)
    line_rules = models.JSONField(default=list, blank=True)
    tag_rules = models.JSONField(default=list, blank=True)
    equipment_rules = models.JSONField(default=list, blank=True)
    process_rules = models.JSONField(default=list, blank=True)
    custom_abbreviations = models.JSONField(default=dict, blank=True)
    custom_service_codes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class PIDObject(models.Model):
    page = models.ForeignKey(PIDPage, on_delete=models.CASCADE, related_name="objects")
    object_type = models.CharField(max_length=50) # equipment, instrument, valve, junction, etc.
    subtype = models.CharField(max_length=100, null=True, blank=True)
    bbox = models.JSONField() # [x1, y1, x2, y2]
    center_x = models.FloatField(null=True, blank=True)
    center_y = models.FloatField(null=True, blank=True)
    confidence = models.FloatField(default=0.0)
    source = models.CharField(max_length=100, default='yolo')
    raw_label = models.CharField(max_length=255, null=True, blank=True)
    normalized_label = models.CharField(max_length=255, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

class PIDText(models.Model):
    page = models.ForeignKey(PIDPage, on_delete=models.CASCADE, related_name="texts")
    text = models.TextField()
    bbox = models.JSONField()
    text_type = models.CharField(max_length=50, null=True, blank=True) # equipment_tag, line_number, etc.
    confidence = models.FloatField(default=0.0)
    normalized_text = models.TextField(null=True, blank=True)

class PIDLine(models.Model):
    page = models.ForeignKey(PIDPage, on_delete=models.CASCADE, related_name="lines")
    geometry = models.JSONField() # LineString array
    line_style = models.CharField(max_length=50, null=True, blank=True)
    line_weight = models.CharField(max_length=50, null=True, blank=True)
    semantic_type = models.CharField(max_length=50, null=True, blank=True) # process_pipe, signal
    service = models.CharField(max_length=100, null=True, blank=True)
    line_number = models.CharField(max_length=100, null=True, blank=True)
    direction = models.CharField(max_length=50, default='UNKNOWN')
    confidence = models.FloatField(default=0.0)
    start_object = models.ForeignKey(PIDObject, related_name="lines_starting_here", on_delete=models.SET_NULL, null=True)
    end_object = models.ForeignKey(PIDObject, related_name="lines_ending_here", on_delete=models.SET_NULL, null=True)

class PIDGraphNode(models.Model):
    document = models.ForeignKey(PIDDocument, on_delete=models.CASCADE, related_name="nodes")
    page = models.ForeignKey(PIDPage, on_delete=models.CASCADE, null=True)
    object_reference = models.ForeignKey(PIDObject, on_delete=models.SET_NULL, null=True)
    node_type = models.CharField(max_length=50) # Source, Process, Sink, Treatment
    label = models.CharField(max_length=255, null=True, blank=True)

class PIDGraphEdge(models.Model):
    document = models.ForeignKey(PIDDocument, on_delete=models.CASCADE, related_name="edges")
    source_node = models.ForeignKey(PIDGraphNode, related_name="outgoing", on_delete=models.CASCADE)
    target_node = models.ForeignKey(PIDGraphNode, related_name="incoming", on_delete=models.CASCADE)
    edge_type = models.CharField(max_length=50) # Process flow, signal
    direction = models.CharField(max_length=50, default='FORWARD')
    service = models.CharField(max_length=100, null=True, blank=True)
    line_reference = models.ForeignKey(PIDLine, on_delete=models.SET_NULL, null=True)
    confidence = models.FloatField(default=0.0)
    evidence = models.JSONField(default=list, blank=True)

class PIDZone(models.Model):
    document = models.ForeignKey(PIDDocument, on_delete=models.CASCADE, related_name="zones")
    zone_code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    zone_type = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=50, default='candidate')
    confidence = models.FloatField(default=0.0)
    geometry = models.JSONField(default=dict, blank=True)
    evidence_summary = models.JSONField(default=list, blank=True)

class ZoneProcess(models.Model):
    zone = models.ForeignKey(PIDZone, on_delete=models.CASCADE, related_name="processes")
    process_type = models.CharField(max_length=100)
    process_subtype = models.CharField(max_length=100, null=True, blank=True)
    confidence = models.FloatField(default=1.0)
    source = models.CharField(max_length=50, default='inference') # authority, inference
    evidence = models.JSONField(default=list, blank=True)

class ProcessSignature(models.Model):
    name = models.CharField(max_length=100)
    equipment_patterns = models.JSONField(default=list, blank=True)
    stream_patterns = models.JSONField(default=list, blank=True)
    utility_patterns = models.JSONField(default=list, blank=True)
    tag_patterns = models.JSONField(default=list, blank=True)
    label_patterns = models.JSONField(default=list, blank=True)
    required_patterns = models.JSONField(default=list, blank=True)
    optional_patterns = models.JSONField(default=list, blank=True)
    forbidden_patterns = models.JSONField(default=list, blank=True)

class ProcessEvidence(models.Model):
    zone = models.ForeignKey(PIDZone, on_delete=models.CASCADE, related_name="evidences")
    evidence_type = models.CharField(max_length=100)
    source_object = models.ForeignKey(PIDObject, on_delete=models.SET_NULL, null=True, blank=True)
    source_text = models.ForeignKey(PIDText, on_delete=models.SET_NULL, null=True, blank=True)
    source_line = models.ForeignKey(PIDLine, on_delete=models.SET_NULL, null=True, blank=True)
    rule_triggered = models.CharField(max_length=255)
    confidence = models.FloatField(default=0.0)
    explanation = models.TextField()

class AuthorityCorrection(models.Model):
    document = models.ForeignKey(PIDDocument, on_delete=models.CASCADE, related_name="corrections")
    object_or_zone = models.CharField(max_length=100) # Reference ID or natural key
    old_value = models.TextField()
    new_value = models.TextField()
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
