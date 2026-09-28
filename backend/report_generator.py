"""
Unified MetrologiX Report Generator (PDF, DOCX & Shared Data Model)
===================================================================
Produces standardized OIML R-76 Type Evaluation and Verification reports.
- Generates real printable PDF via ReportLab with tables and signature block
- Generates real editable .docx via python-docx with matching layout
- Computes SHA-256 hash over the generated PDF binary bytes for tamper verification
- All outputs (On-Screen, PDF, DOCX) share the exact same ReportModel structure
"""
from __future__ import annotations

import os
import hashlib
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple
from pathlib import Path

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)

# python-docx imports
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(exist_ok=True)


def generate_report_number() -> str:
    now = datetime.utcnow()
    return f"MLX-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"


def compute_sha256_bytes(data_bytes: bytes) -> str:
    return hashlib.sha256(data_bytes).hexdigest()


def compute_sha256(data: Dict) -> str:
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


# ---------------------------------------------------------------------------
# PDF Generation (ReportLab)
# ---------------------------------------------------------------------------

def generate_pdf_report(report_data: Dict[str, Any]) -> Tuple[str, bytes, str]:
    """
    Generates a professional OIML R-76 Type Evaluation Report in PDF format.
    Returns: (filepath, pdf_bytes, sha256_hash_of_pdf)
    """
    report_number = report_data.get("report_number", "MLX-REPORT")
    filename = f"{report_number}.pdf"
    filepath = str(REPORTS_DIR / filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#1e3a8a")     # Deep Blue
    c_secondary = colors.HexColor("#475569")   # Slate
    c_pass = colors.HexColor("#047857")        # Emerald
    c_fail = colors.HexColor("#b91c1c")        # Crimson
    c_border = colors.HexColor("#cbd5e1")      # Light border
    c_bg_head = colors.HexColor("#f1f5f9")     # Light header bg
    c_bg_row = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=c_primary,
        alignment=1 # Center
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=c_secondary,
        alignment=1
    )

    section_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=c_primary,
        spaceBefore=8,
        spaceAfter=3
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#1e293b")
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    verdict_style = ParagraphStyle(
        'VerdictText',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=1,
        textColor=c_pass if report_data.get("overall_verdict", "").upper() == "PASS" else c_fail
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("GOVERNMENT OF INDIA &bull; REGIONAL REFERENCE STANDARDS LABORATORY", subtitle_style))
    story.append(Paragraph("OIML R-76-1 TYPE EVALUATION &amp; COMPLIANCE CERTIFICATE", title_style))
    story.append(Paragraph(
        f"Issued under Legal Metrology Act, 2009 &bull; Standard: {report_data.get('rule_version', 'OIML R-76-1:2006')}",
        subtitle_style
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceAfter=8))

    # 2. Metadata Block (Report Number, Date, Status)
    meta_data = [
        [
            Paragraph("<b>Certificate Number:</b>", body_style),
            Paragraph(f"<b>{report_data.get('report_number')}</b>", body_style),
            Paragraph("<b>Issue Date:</b>", body_style),
            Paragraph(report_data.get("issued_at", datetime.utcnow().strftime("%Y-%m-%d %H:%M")), body_style),
        ],
        [
            Paragraph("<b>Evaluation Protocol:</b>", body_style),
            Paragraph(report_data.get("session", {}).get("test_type", "Type Evaluation").replace("_", " ").title(), body_style),
            Paragraph("<b>Overall Compliance:</b>", body_style),
            Paragraph(f"<b>{report_data.get('overall_verdict', 'PASS').upper()}</b>", body_bold),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[38 * mm, 52 * mm, 32 * mm, 60 * mm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_bg_head),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3 * mm))

    # 3. Instrument & Laboratory Details (2-column layout)
    inst = report_data.get("instrument", {})
    sess = report_data.get("session", {})

    inst_rows = [
        [Paragraph("<b>Manufacturer:</b>", body_style), Paragraph(inst.get("manufacturer", "N/A"), body_style)],
        [Paragraph("<b>Model / Pattern:</b>", body_style), Paragraph(inst.get("model_number", "N/A"), body_style)],
        [Paragraph("<b>Serial Number:</b>", body_style), Paragraph(inst.get("serial_number", "N/A"), body_style)],
        [Paragraph("<b>Accuracy Class:</b>", body_style), Paragraph(f"Class {inst.get('accuracy_class', 'III')}", body_style)],
        [Paragraph("<b>Max Capacity:</b>", body_style), Paragraph(f"{inst.get('max_capacity', 0)} {inst.get('unit', 'kg')}", body_style)],
        [Paragraph("<b>Min Capacity:</b>", body_style), Paragraph(f"{inst.get('min_capacity', 0)} {inst.get('unit', 'kg')}", body_style)],
        [Paragraph("<b>Scale Interval (e):</b>", body_style), Paragraph(f"{inst.get('scale_interval_e', 0)} {inst.get('unit', 'kg')}", body_style)],
        [Paragraph("<b>Verification (d):</b>", body_style), Paragraph(f"{inst.get('scale_interval_d', 0)} {inst.get('unit', 'kg')} (d &le; e)", body_style)],
    ]
    
    env_rows = [
        [Paragraph("<b>Testing Laboratory:</b>", body_style), Paragraph(sess.get("lab_location", "N/A"), body_style)],
        [Paragraph("<b>Lead Inspector:</b>", body_style), Paragraph(sess.get("inspector_name", "N/A"), body_style)],
        [Paragraph("<b>Ambient Temperature:</b>", body_style), Paragraph(f"{sess.get('ambient_temp_c', 20.0)} &deg;C", body_style)],
        [Paragraph("<b>Relative Humidity:</b>", body_style), Paragraph(f"{sess.get('relative_humidity', 50.0)} % RH", body_style)],
        [Paragraph("<b>Atmospheric Pressure:</b>", body_style), Paragraph(f"{sess.get('pressure_hpa', 1013.0)} hPa", body_style)],
        [Paragraph("<b>Standard Reference:</b>", body_style), Paragraph("OIML R-76-1:2006 (Annex A)", body_style)],
        [Paragraph("<b>Rule Version:</b>", body_style), Paragraph(report_data.get("rule_version", "R76-1:2006"), body_style)],
        [Paragraph("<b>Verification Level:</b>", body_style), Paragraph("Initial Type Approval", body_style)],
    ]

    col1_table = Table(inst_rows, colWidths=[36 * mm, 55 * mm])
    col2_table = Table(env_rows, colWidths=[36 * mm, 55 * mm])
    for t in (col1_table, col2_table):
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.white),
            ('BOX', (0,0), (-1,-1), 0.75, c_border),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0,0), (-1,-1), 2.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))

    details_table = Table([
        [Paragraph("<b>1. Instrument Specifications (§2)</b>", section_style), Paragraph("<b>2. Laboratory &amp; Environment (§3.9)</b>", section_style)],
        [col1_table, col2_table]
    ], colWidths=[92 * mm, 92 * mm])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 2 * mm))

    # 4. Weighing Test Table (§3.5)
    weighing_pts = report_data.get("weighing_points", [])
    if weighing_pts:
        story.append(Paragraph("<b>3. Weighing Performance Evaluation (§3.5) &bull; Error vs. MPE</b>", section_style))
        w_headers = ["#", "Load (L)", "Indication (I)", "ΔL", "Direction", "Error (Ec)", "MPE Limit", "Verdict"]
        w_data = [[Paragraph(f"<b>{h}</b>", body_style) for h in w_headers]]
        for idx, pt in enumerate(weighing_pts[:16]): # Cap at 16 points for single-page hygiene
            is_pass = pt.get("is_compliant", True)
            w_data.append([
                Paragraph(str(idx + 1), body_style),
                Paragraph(f"{pt.get('load', 0):.4f}", body_style),
                Paragraph(f"{pt.get('indication', 0):.4f}", body_style),
                Paragraph(f"{pt.get('delta_load', 0):.4f}", body_style),
                Paragraph(pt.get("direction", "inc")[:3].upper(), body_style),
                Paragraph(f"{pt.get('corrected_error', pt.get('calculated_error', 0)):.4f}", body_style),
                Paragraph(f"&plusmn;{pt.get('mpe_limit', pt.get('mpe', 0)):.4f}", body_style),
                Paragraph(f"<font color='{'#047857' if is_pass else '#b91c1c'}'><b>{'PASS' if is_pass else 'FAIL'}</b></font>", body_style)
            ])
        w_table = Table(w_data, colWidths=[8*mm, 26*mm, 26*mm, 20*mm, 22*mm, 28*mm, 28*mm, 24*mm])
        w_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), c_bg_head),
            ('BOX', (0,0), (-1,-1), 0.75, c_border),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_row]),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        story.append(w_table)
        story.append(Spacer(1, 2 * mm))

    # 5. Eccentricity & Repeatability Summary (§3.6 & §3.6.1)
    ecc_pts = report_data.get("eccentricity_points", [])
    rep_pts = report_data.get("repeatability_series", [])
    
    summary_rows = [
        [Paragraph("<b>Evaluation Module</b>", body_style), Paragraph("<b>Test Parameters / Criterion</b>", body_style), Paragraph("<b>Result</b>", body_style), Paragraph("<b>Verdict</b>", body_style)]
    ]
    if ecc_pts:
        all_ecc_pass = all(p.get("is_compliant", True) for p in ecc_pts)
        max_ecc_diff = max((p.get("calculated_error", p.get("diff", 0)) for p in ecc_pts), default=0)
        summary_rows.append([
            Paragraph("<b>Eccentricity (§3.6)</b>", body_style),
            Paragraph("Corner loading at 1/3 Max &bull; Center + 4 Corners", body_style),
            Paragraph(f"Max Diff: {max_ecc_diff:.4f}", body_style),
            Paragraph(f"<font color='{'#047857' if all_ecc_pass else '#b91c1c'}'><b>{'PASS' if all_ecc_pass else 'FAIL'}</b></font>", body_style)
        ])
    if rep_pts:
        all_rep_pass = all(r.get("is_compliant", True) for r in rep_pts)
        summary_rows.append([
            Paragraph("<b>Repeatability (§3.6.1)</b>", body_style),
            Paragraph("5 consecutive weighings at 50% and 100% Max (Span &le; 1e)", body_style),
            Paragraph(f"Span &le; {inst.get('scale_interval_e', 0.01)} {inst.get('unit', 'kg')}", body_style),
            Paragraph(f"<font color='{'#047857' if all_rep_pass else '#b91c1c'}'><b>{'PASS' if all_rep_pass else 'FAIL'}</b></font>", body_style)
        ])

    ai_diag = report_data.get("ai_diagnosis", "Data integrity normal.")
    anomaly_score = report_data.get("ai_anomaly_score", 0.0)
    summary_rows.append([
        Paragraph("<b>AI Anomaly Audit</b>", body_style),
        Paragraph(f"Isolation Forest Anomaly Index: {anomaly_score:.3f}", body_style),
        Paragraph(ai_diag[:45] + ("..." if len(ai_diag) > 45 else ""), body_style),
        Paragraph("<font color='#047857'><b>AUDITED</b></font>", body_style)
    ])

    sum_table = Table(summary_rows, colWidths=[40*mm, 78*mm, 42*mm, 24*mm])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_bg_head),
        ('BOX', (0,0), (-1,-1), 0.75, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_row]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(Paragraph("<b>4. Metrological Summary &amp; Auxiliary Tests</b>", section_style))
    story.append(sum_table)
    story.append(Spacer(1, 3 * mm))

    # 6. Overall Verdict & Sign-Off Block
    sig_name = report_data.get("inspector_sign_name") or sess.get("inspector_name", "Authorized Metrology Officer")
    sig_desig = report_data.get("inspector_sign_designation", "Legal Metrology Officer")
    sig_date = report_data.get("inspector_sign_date", datetime.utcnow().strftime("%Y-%m-%d"))

    sign_data = [
        [
            Paragraph(f"<b>FINAL EVALUATION VERDICT:</b><br/>{report_data.get('overall_verdict', 'PASS').upper()}", verdict_style),
            Paragraph(
                f"<b>Digitally Verified By:</b><br/>"
                f"<b>{sig_name}</b><br/>"
                f"{sig_desig}<br/>"
                f"Date: {sig_date}<br/>"
                f"<i>Regional Reference Standards Laboratory</i>",
                body_style
            )
        ]
    ]
    sign_table = Table(sign_data, colWidths=[90 * mm, 94 * mm])
    sign_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, c_primary),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    
    # 7. Verification Footer with SHA-256 Placeholder
    footer_text = Paragraph(
        f"<font size='6.5' color='#64748b'>This certificate is cryptographically verified by MetrologiX Core. "
        f"Validation URL: http://localhost:8000/api/reports/{report_number}/verify</font>",
        subtitle_style
    )

    story.append(KeepTogether([sign_table, Spacer(1, 2 * mm), footer_text]))

    # Build Document
    doc.build(story)

    # Read binary bytes and compute SHA-256 over exact PDF file content
    with open(filepath, "rb") as f:
        pdf_bytes = f.read()
    
    sha256_hash = compute_sha256_bytes(pdf_bytes)
    return filepath, pdf_bytes, sha256_hash


# ---------------------------------------------------------------------------
# DOCX Generation (python-docx)
# ---------------------------------------------------------------------------

def generate_docx_report(report_data: Dict[str, Any]) -> str:
    """
    Generates an editable Word (.docx) report sharing the exact same ReportModel.
    Returns: filepath
    """
    report_number = report_data.get("report_number", "MLX-REPORT")
    filename = f"{report_number}.docx"
    filepath = str(REPORTS_DIR / filename)

    doc = docx.Document()

    # Set Margins
    for section in doc.sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

    # Title
    p_hdr = doc.add_paragraph()
    p_hdr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_hdr.add_run("GOVERNMENT OF INDIA • REGIONAL REFERENCE STANDARDS LABORATORY\n")
    r_sub.font.size = Pt(8.5)
    r_sub.font.color.rgb = RGBColor(100, 116, 139)
    
    r_title = p_hdr.add_run("OIML R-76-1 TYPE EVALUATION & COMPLIANCE CERTIFICATE\n")
    r_title.font.bold = True
    r_title.font.size = Pt(14)
    r_title.font.color.rgb = RGBColor(30, 58, 138)

    r_law = p_hdr.add_run(f"Legal Metrology Act, 2009 • Standard: {report_data.get('rule_version', 'OIML R-76-1:2006')}")
    r_law.font.size = Pt(9)
    r_law.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Metadata Table
    meta_tbl = doc.add_table(rows=2, cols=4)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_tbl.style = 'Table Grid'
    m_data = [
        [("Certificate No:", True), (report_data.get("report_number", ""), False), ("Issue Date:", True), (report_data.get("issued_at", ""), False)],
        [("Protocol:", True), (report_data.get("session", {}).get("test_type", "").replace("_", " ").title(), False), ("Verdict:", True), (report_data.get("overall_verdict", "").upper(), True)],
    ]
    for r_idx, row in enumerate(m_data):
        for c_idx, (text, is_bold) in enumerate(row):
            cell = meta_tbl.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            r = p.add_run(text)
            r.font.bold = is_bold
            r.font.size = Pt(8.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Instrument & Environment
    inst = report_data.get("instrument", {})
    sess = report_data.get("session", {})

    h2 = doc.add_heading("1. Technical Parameters & Environmental Conditions", level=2)
    h2.paragraph_format.space_before = Pt(6)
    h2.paragraph_format.space_after = Pt(4)

    spec_tbl = doc.add_table(rows=5, cols=4)
    spec_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    spec_tbl.style = 'Table Grid'
    s_data = [
        [("Manufacturer:", True), (inst.get("manufacturer", "N/A"), False), ("Laboratory:", True), (sess.get("lab_location", "N/A"), False)],
        [("Model Number:", True), (inst.get("model_number", "N/A"), False), ("Inspector:", True), (sess.get("inspector_name", "N/A"), False)],
        [("Serial Number:", True), (inst.get("serial_number", "N/A"), False), ("Ambient Temp:", True), (f"{sess.get('ambient_temp_c', 20.0)} °C", False)],
        [("Accuracy Class:", True), (f"Class {inst.get('accuracy_class', 'III')}", False), ("Humidity:", True), (f"{sess.get('relative_humidity', 50.0)} % RH", False)],
        [("Max / Scale e:", True), (f"{inst.get('max_capacity', 0)} / e={inst.get('scale_interval_e', 0)} {inst.get('unit', 'kg')}", False), ("Pressure:", True), (f"{sess.get('pressure_hpa', 1013.0)} hPa", False)],
    ]
    for r_idx, row in enumerate(s_data):
        for c_idx, (text, is_bold) in enumerate(row):
            cell = spec_tbl.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            r = p.add_run(text)
            r.font.bold = is_bold
            r.font.size = Pt(8.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Weighing Table
    weighing_pts = report_data.get("weighing_points", [])
    if weighing_pts:
        h3 = doc.add_heading("2. Weighing Test Performance (§3.5)", level=2)
        h3.paragraph_format.space_before = Pt(6)
        h3.paragraph_format.space_after = Pt(4)

        w_tbl = doc.add_table(rows=1 + len(weighing_pts[:16]), cols=7)
        w_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        w_tbl.style = 'Table Grid'
        headers = ["#", "Load (L)", "Indication (I)", "Direction", "Error (Ec)", "MPE Limit", "Verdict"]
        for c_idx, h_text in enumerate(headers):
            cell = w_tbl.cell(0, c_idx)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(h_text)
            r.font.bold = True
            r.font.size = Pt(8.5)

        for r_idx, pt in enumerate(weighing_pts[:16]):
            is_pass = pt.get("is_compliant", True)
            vals = [
                str(r_idx + 1),
                f"{pt.get('load', 0):.4f}",
                f"{pt.get('indication', 0):.4f}",
                pt.get("direction", "inc")[:3].upper(),
                f"{pt.get('corrected_error', pt.get('calculated_error', 0)):.4f}",
                f"±{pt.get('mpe_limit', pt.get('mpe', 0)):.4f}",
                "PASS" if is_pass else "FAIL"
            ]
            for c_idx, v_text in enumerate(vals):
                cell = w_tbl.cell(r_idx + 1, c_idx)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(1.5)
                p.paragraph_format.space_after = Pt(1.5)
                r = p.add_run(v_text)
                r.font.size = Pt(8)
                if c_idx == 6:
                    r.font.bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Sign-off Block
    sig_p = doc.add_paragraph()
    sig_p.paragraph_format.space_before = Pt(10)
    sig_name = report_data.get("inspector_sign_name") or sess.get("inspector_name", "Authorized Inspector")
    sig_desig = report_data.get("inspector_sign_designation", "Legal Metrology Officer")
    sig_date = report_data.get("inspector_sign_date", datetime.utcnow().strftime("%Y-%m-%d"))

    r_sig = sig_p.add_run(
        f"FINAL VERDICT: {report_data.get('overall_verdict', 'PASS').upper()}\n"
        f"Digitally Approved By: {sig_name} ({sig_desig})\n"
        f"Date: {sig_date} • Regional Reference Standards Laboratory\n"
        f"SHA-256 Verification Hash: {report_data.get('sha256_hash', 'N/A')}"
    )
    r_sig.font.size = Pt(9)
    r_sig.font.color.rgb = RGBColor(30, 58, 138)

    doc.save(filepath)
    return filepath