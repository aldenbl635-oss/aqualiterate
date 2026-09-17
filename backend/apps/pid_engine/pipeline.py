import random
import uuid
import datetime

def mock_pid_pipeline(site, image_file=None):
    from .models import (
        PIDDocument, PIDPage, PIDObject, PIDText, PIDLine, 
        PIDGraphNode, PIDGraphEdge, PIDZone, ZoneProcess
    )
    
    # Phase 6 & 7: Document and Page Creation
    doc = PIDDocument.objects.create(site=site, file=image_file, processing_status="PROCESSING")
    page = PIDPage.objects.create(document=doc, width=1920, height=1080)
    
    # Hashing the timestamp as substitute for image hash if image_file is inaccessible
    random.seed(str(datetime.datetime.now()))
    
    # Phase 8: Symbol Detection (YOLO mock)
    num_equipment = random.randint(3, 7)
    objects = []
    
    possible_types = ['Pump', 'Tank', 'Cooling Tower', 'Heat Exchanger', 'Filter']
    for i in range(num_equipment):
        obj_type = random.choice(possible_types)
        obj = PIDObject.objects.create(
            page=page, object_type='equipment', subtype=obj_type,
            bbox=[random.randint(100, 1500), random.randint(100, 900), random.randint(150, 1600), random.randint(150, 1000)],
            confidence=round(random.uniform(0.75, 0.99), 2),
            normalized_label=f"{obj_type.upper()}-10{i}"
        )
        objects.append(obj)
        
    # Phase 9: OCR Pipeline
    for i, obj in enumerate(objects):
        PIDText.objects.create(
            page=page, text=obj.normalized_label,
            bbox=obj.bbox, text_type='equipment_tag',
            confidence=0.9, normalized_text=obj.normalized_label
        )
        
    # Phase 11 & 12: Line/Arrow Detection + Topology Reconstruction
    lines = []
    for i in range(len(objects) - 1):
        line = PIDLine.objects.create(
            page=page, geometry=[],
            semantic_type='process_pipe', direction='FORWARD',
            start_object=objects[i], end_object=objects[i+1],
            confidence=0.85
        )
        lines.append(line)
        
    # Phase 13 & 14: Process Graph Construction
    nodes = []
    for obj in objects:
        node = PIDGraphNode.objects.create(
            document=doc, page=page, object_reference=obj, 
            node_type='Process', label=obj.normalized_label
        )
        nodes.append(node)
        
    edges = []
    for i, line in enumerate(lines):
        edge = PIDGraphEdge.objects.create(
            document=doc, source_node=nodes[i], target_node=nodes[i+1],
            edge_type='Process flow', direction='FORWARD',
            line_reference=line
        )
        edges.append(edge)
        
    # Phase 20 & 21: Functional Zone Detection & Reasoning
    num_zones = random.randint(2, max(2, len(nodes) - 1))
    
    # Simply partitioning nodes into zones for the mock
    for z_idx in range(num_zones):
        zone = PIDZone.objects.create(
            document=doc, zone_code=f"Z-{z_idx + 1}",
            name=f"Inferred Process Area {z_idx + 1}",
            status="candidate", confidence=0.88,
            evidence_summary=["Equipment clustering", "Continuous pipe topology"]
        )
        
        # Assign a candidate process
        process_pools = ['Cooling', 'Treatment', 'Boiler', 'Washing', 'Storage', 'UNKNOWN']
        detected_process = random.choice(process_pools)
        
        ZoneProcess.objects.create(
            zone=zone, process_type=detected_process,
            source='inference', confidence=0.75,
            evidence=[{"type": "equipment_match", "triggered": True}]
        )

    doc.processing_status = "WAITING_FOR_AUTHORITY"
    doc.save()

    return doc
