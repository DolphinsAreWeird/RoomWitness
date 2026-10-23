"""
Agent 04 — Document Generator (local storage).
Generates professional Thai legal PDFs using Platypus + Leelawadee font.
S3 upload (agent04_doc_generator/uploader.py) kept for future use.

Run from roomwitness-rag/:
    python -m uvicorn services.agent04_service:app --port 8004 --reload
"""

import io
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import boto3

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from shared.typhoon_client import get_typhoon_llm

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RoomWitness Agent 04 — Document Generator (Local)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

# Criterion 4 (Responsible AI & safety): persist one audit record per case —
# inputs, which law each verdict cites, and the outcome — so a judge or a
# renter can trace how a verdict was reached. Write is best-effort: a failure
# here must never break document generation, the thing the renter came for.
_AUDIT_BUCKET = os.getenv("AUDIT_BUCKET", "")

def _write_audit_record(case_id: str, context: dict, documents: dict, docs_to_generate: list) -> None:
    if not _AUDIT_BUCKET:
        return
    record = {
        "case_id": case_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "claims": context.get("claims", []),
        "verdicts": context.get("verdicts", []),
        "total_unlawful_thb": context.get("total_unlawful_thb", 0),
        "case_summary_th": context.get("case_summary_th", ""),
        "case_summary_en": context.get("case_summary_en", ""),
        "documents_generated": list(documents.keys()),
        "estimated_llm_calls": len(docs_to_generate) * 3,  # approx: facts/legal_basis/demand (or equivalent) per doc
    }
    try:
        boto3.client("s3", region_name=os.getenv("AWS_REGION", "ap-southeast-1")).put_object(
            Bucket=_AUDIT_BUCKET,
            Key=f"audit/{case_id}.json",
            Body=json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
    except Exception:
        logger.exception("Audit record write failed for case_id=%s (non-fatal)", case_id)

# ── Fonts ──────────────────────────────────────────────────────────────────────

_F_REG  = "ThaiReg"
_F_BOLD = "ThaiBold"
_FONTS_DIR = Path(__file__).parent / "fonts"

def _register_fonts() -> tuple[str, str]:
    # Portable path (bundled in the image/repo) first, Windows system font as a
    # local-dev fallback for whoever still has it installed. Helvetica has no
    # Thai glyphs — that fallback renders garbage, not an error, so it's last resort.
    candidates = [
        (_FONTS_DIR / "NotoSansThai-Regular.ttf", _FONTS_DIR / "NotoSansThai-Bold.ttf"),
        (Path(r"C:\Windows\Fonts\leelawad.ttf"), Path(r"C:\Windows\Fonts\leelawdb.ttf")),
    ]
    for reg_path, bold_path in candidates:
        try:
            pdfmetrics.registerFont(TTFont(_F_REG, str(reg_path)))
            pdfmetrics.registerFont(TTFont(_F_BOLD, str(bold_path)))
            return _F_REG, _F_BOLD
        except Exception:
            continue
    logger.warning("No Thai font found (tried %s) — falling back to Helvetica (no Thai glyphs)", candidates)
    return "Helvetica", "Helvetica-Bold"

FR, FB = _register_fonts()

# ── Colour palette ─────────────────────────────────────────────────────────────
# Matches the live product's brand tokens (nextjs-frontend/src/app/globals.css)
# so a generated PDF looks like it came from the same product as the web app.

NAVY     = colors.HexColor("#16324A")
NAVY_LT  = colors.HexColor("#EDF3F8")
STEEL    = colors.HexColor("#244C69")
RED      = colors.HexColor("#B5333D")
RED_BG   = colors.HexColor("#FDF0F1")
GREEN    = colors.HexColor("#18734F")
GREEN_BG = colors.HexColor("#EDF8F1")
ORANGE   = colors.HexColor("#96620D")
ORANGE_BG= colors.HexColor("#FFF7E6")
GREY_LT  = colors.HexColor("#F7F9FB")
GREY     = colors.HexColor("#AAAAAA")
BORDER   = colors.HexColor("#DCE4EC")

# ── Styles ─────────────────────────────────────────────────────────────────────

def _styles() -> dict:
    return {
        "doc_title": ParagraphStyle(
            "doc_title", fontName=FB, fontSize=16,
            alignment=TA_CENTER, textColor=NAVY,
            spaceAfter=4, leading=22,
        ),
        "doc_subtitle": ParagraphStyle(
            "doc_subtitle", fontName=FR, fontSize=10,
            alignment=TA_CENTER, textColor=STEEL,
            spaceAfter=2,
        ),
        "section_hdr": ParagraphStyle(
            "section_hdr", fontName=FB, fontSize=11,
            textColor=NAVY, spaceBefore=12, spaceAfter=4, leading=16,
        ),
        # ponytail: left-aligned, not justified — Thai has few spaces to
        # stretch against, so TA_JUSTIFY blew single spaces into huge gaps
        "body": ParagraphStyle(
            "body", fontName=FR, fontSize=10,
            leading=17, spaceAfter=6, alignment=TA_LEFT,
        ),
        "body_right": ParagraphStyle(
            "body_right", fontName=FR, fontSize=10,
            leading=17, spaceAfter=4, alignment=TA_RIGHT,
        ),
        "body_center": ParagraphStyle(
            "body_center", fontName=FR, fontSize=10,
            leading=17, spaceAfter=4, alignment=TA_CENTER,
        ),
        "label": ParagraphStyle(
            "label", fontName=FB, fontSize=10,
            leading=16, spaceAfter=2,
        ),
        "small": ParagraphStyle(
            "small", fontName=FR, fontSize=8.5,
            textColor=colors.HexColor("#555555"), leading=13,
        ),
        "table_hdr": ParagraphStyle(
            "table_hdr", fontName=FB, fontSize=9,
            textColor=colors.white, alignment=TA_CENTER, leading=13,
        ),
        "table_cell": ParagraphStyle(
            "table_cell", fontName=FR, fontSize=9,
            leading=13, alignment=TA_LEFT,
        ),
        "table_cell_c": ParagraphStyle(
            "table_cell_c", fontName=FR, fontSize=9,
            leading=13, alignment=TA_CENTER,
        ),
        "verdict_unlawful": ParagraphStyle(
            "verdict_unlawful", fontName=FB, fontSize=9,
            textColor=RED, alignment=TA_CENTER, leading=13,
        ),
        "verdict_lawful": ParagraphStyle(
            "verdict_lawful", fontName=FB, fontSize=9,
            textColor=GREEN, alignment=TA_CENTER, leading=13,
        ),
        "verdict_disputed": ParagraphStyle(
            "verdict_disputed", fontName=FB, fontSize=9,
            textColor=ORANGE, alignment=TA_CENTER, leading=13,
        ),
        "sig_label": ParagraphStyle(
            "sig_label", fontName=FR, fontSize=10,
            alignment=TA_CENTER, leading=16,
        ),
    }

_VERDICT_LABEL = {
    "UNLAWFUL": "ไม่ชอบด้วยกฎหมาย",
    "LAWFUL":   "ชอบด้วยกฎหมาย",
    "DISPUTED": "เป็นข้อพิพาท",
}
_VERDICT_THAI = {"UNLAWFUL": "UNLAWFUL", "LAWFUL": "LAWFUL", "DISPUTED": "DISPUTED"}

# ── LLM helpers ────────────────────────────────────────────────────────────────

_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "คุณเป็นผู้เชี่ยวชาญด้านการร่างเอกสารกฎหมายไทย "
     "ร่างเฉพาะส่วนที่ขอ ใช้ภาษาไทยทางการและสุภาพ "
     "วันที่ทุกรูปแบบต้องเป็น พ.ศ. เสมอ "
     "ตอบเป็นข้อความล้วนๆ ไม่ต้องมี JSON หรือ Markdown หรือ bullet"),
    ("human",
     "ประเภทเอกสาร: {doc_type}\n"
     "ส่วนที่ต้องการ: {section_key}\n"
     "คำสั่ง: {instruction}\n\n"
     "ข้อมูลคดี (JSON):\n{context_json}\n\n"
     "ร่างส่วนนี้ (2-4 ประโยค ภาษาไทยทางการ):"),
])

DOC_META = {
    "demand_letter":    {"doc_type": "หนังสือเรียกร้องคืนเงิน",     "label": "หนังสือเรียกร้องคืนเงินประกันการเช่า"},
    "evidence_summary": {"doc_type": "สรุปหลักฐานและผลวินิจฉัย",   "label": "สรุปหลักฐานและผลการวินิจฉัยคดี"},
    "ocpb_complaint":   {"doc_type": "หนังสือร้องเรียน สคบ.",         "label": "หนังสือร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองผู้บริโภค"},
}

# LLM sections — only narrative parts; structured elements are built from data
_LLM_SECTIONS = {
    "demand_letter": [
        ("opening",
         "ร่างย่อหน้าเปิดเรื่อง 2-3 ประโยค ระบุว่าผู้เช่าส่งหนังสือนี้เพื่อเรียกร้องคืนเงินประกัน "
         "อ้างถึงสัญญาเช่าและการออกจากห้องพัก"),
        ("facts",
         "ร่างข้อเท็จจริง 3-4 ประโยค อธิบายว่าเจ้าของบ้านหักเงินประกันจำนวน {amount} บาท "
         "โดยอ้างค่าเสียหายที่ถูกตัดสินว่าไม่ชอบด้วยกฎหมาย"),
        ("legal_basis",
         "ร่างเหตุผลทางกฎหมาย 2-3 ประโยค อ้างอิง ประกาศ สคบ. 2568 และ ป.พ.พ. มาตรา 537-571 "
         "ที่ห้ามเจ้าของบ้านหักเงินประกันสำหรับความเสื่อมสภาพตามปกติหรือความเสียหายที่มีอยู่ก่อน"),
        ("demand",
         "ร่างข้อเรียกร้อง 2-3 ประโยค เรียกร้องให้คืนเงิน {amount} บาท ภายใน 7 วัน "
         "มิเช่นนั้นจะยื่นร้องเรียน สคบ. และดำเนินคดีแพ่ง"),
    ],
    "evidence_summary": [
        ("overview",
         "ร่างภาพรวมคดี 2-3 ประโยค อธิบายบริบทของข้อพิพาทและจำนวนเงินที่เกี่ยวข้อง"),
        ("analysis",
         "ร่างบทวิเคราะห์ 3-4 ประโยค อธิบายวิธีการตรวจสอบหลักฐาน "
         "(การเปรียบเทียบภาพถ่าย ตรวจสอบสัญญา และการวิเคราะห์ทางกฎหมาย)"),
        ("recommendation",
         "ร่างข้อแนะนำ 2-3 ประโยค แนะนำขั้นตอนที่ผู้เช่าควรดำเนินการต่อไป "
         "รวมถึงการยื่น สคบ. หรือฟ้องร้องทางแพ่ง"),
    ],
    "ocpb_complaint": [
        ("intro",
         "ร่างย่อหน้าแนะนำตัว 2-3 ประโยค ระบุว่าผู้ร้องเรียนคือผู้เช่า "
         "ยื่นร้องเรียนต่อ สคบ. เพื่อขอความเป็นธรรมเรื่องเงินประกัน"),
        ("facts",
         "ร่างข้อเท็จจริง 4-5 ประโยค อธิบายพฤติการณ์ที่เจ้าของบ้านหักเงินประกัน {amount} บาท "
         "โดยไม่มีสิทธิ์ตามกฎหมาย"),
        ("relief",
         "ร่างคำขอให้ดำเนินการ 2-3 ประโยค ขอให้ สคบ. ไกล่เกลี่ยและบังคับให้เจ้าของบ้านคืนเงิน {amount} บาท "
         "ภายในระยะเวลาที่กำหนด"),
    ],
}


def _get_llm() -> ChatOpenAI | None:
    try:
        return get_typhoon_llm(temperature=0.05)
    except Exception:
        logger.warning("LLM client construction failed — fallback text used", exc_info=True)
        return None


def _llm_text(doc_type: str, section_key: str, instruction: str, context: dict, llm: ChatOpenAI) -> str:
    chain = _PROMPT | llm | StrOutputParser()
    return chain.invoke({
        "doc_type": doc_type,
        "section_key": section_key,
        "instruction": instruction,
        "context_json": json.dumps(context, ensure_ascii=False, indent=2),
    }).strip()


def _fallback(section_key: str, total: float) -> str:
    if "opening" in section_key or "intro" in section_key:
        return (
            f"ข้าพเจ้าในฐานะผู้เช่า ขอส่งหนังสือนี้เพื่อเรียกร้องคืนเงินประกันการเช่าจำนวน "
            f"{total:,.0f} บาท ซึ่งถูกหักโดยไม่ชอบด้วยกฎหมาย"
        )
    if "demand" in section_key or "relief" in section_key:
        return (
            f"จึงขอเรียกร้องให้ท่านคืนเงินจำนวน {total:,.0f} บาท "
            f"ภายใน 7 วันนับจากวันที่ได้รับหนังสือฉบับนี้"
        )
    return f"(ไม่สามารถสร้างเนื้อหาได้ — TYPHOON_API_KEY not configured)"


def _generate_sections(doc_type: str, context: dict, llm: ChatOpenAI | None) -> dict[str, str]:
    total = context.get("total_unlawful_thb", 0)
    result: dict[str, str] = {}
    for key, instr in _LLM_SECTIONS.get(doc_type, []):
        instr_fmt = instr.format(amount=f"{total:,.0f}")
        if llm:
            try:
                result[key] = _llm_text(doc_type, key, instr_fmt, context, llm)
                logger.info("LLM: %s › %s OK", doc_type, key)
            except Exception as exc:
                logger.warning("LLM failed %s › %s: %s", doc_type, key, exc)
                result[key] = _fallback(key, total)
        else:
            result[key] = _fallback(key, total)
    return result


# ── Shared PDF helpers ─────────────────────────────────────────────────────────

def _doc(buf: io.BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.5*cm, rightMargin=2.5*cm,
        topMargin=2.2*cm, bottomMargin=2.2*cm,
    )


def _hr(color=NAVY, thickness=1.5) -> HRFlowable:
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=6, spaceBefore=2)


def _thin_hr() -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.5, color=GREY, spaceAfter=4, spaceBefore=4)


def _verdict_badge_style(verdict: str, styles: dict) -> ParagraphStyle:
    mapping = {
        "UNLAWFUL": styles["verdict_unlawful"],
        "LAWFUL":   styles["verdict_lawful"],
        "DISPUTED": styles["verdict_disputed"],
    }
    return mapping.get(verdict, styles["verdict_disputed"])



# Required for criterion 4 (Responsible AI & safety): every generated document
# carries a visible disclaimer and an escalation path, not just the web UI.
_DISCLAIMER_TH = (
    "เอกสารฉบับนี้จัดทำขึ้นโดยระบบปัญญาประดิษฐ์ (AI) เพื่อช่วยผู้เช่าเตรียมข้อมูลเบื้องต้น "
    "มิใช่คำแนะนำทางกฎหมายอย่างเป็นทางการ และไม่ใช่เอกสารที่ออกโดยทนายความหรือหน่วยงานราชการ "
    "โปรดตรวจสอบความถูกต้องและปรึกษาผู้เชี่ยวชาญก่อนนำไปใช้อย่างเป็นทางการ"
)
_ESCALATION_TH = (
    "หากกรณีของท่านมีความซับซ้อน หรือหลักฐานมีความเชื่อมั่นต่ำ ท่านสามารถติดต่อสายด่วนสำนักงานคณะกรรมการ"
    "คุ้มครองผู้บริโภค (สคบ.) โทร. 1166 หรือปรึกษาทนายความเพื่อขอคำแนะนำเพิ่มเติม"
)

def _disclaimer_block(s: dict) -> list:
    return [
        Spacer(1, 0.4*cm),
        _thin_hr(),
        Paragraph(f"<b>ข้อจำกัดความรับผิดชอบ:</b> {_DISCLAIMER_TH}", s["small"]),
        Spacer(1, 0.15*cm),
        Paragraph(f"<b>ช่องทางขอความช่วยเหลือเพิ่มเติม:</b> {_ESCALATION_TH}", s["small"]),
    ]


def _page_num_canvas_maker(page_label: str, case_id: str):
    """Returns a canvas maker function that draws a letterhead band and
    branded footer on each page, so a generated PDF reads as the same
    product as the web app rather than a bare ReportLab printout."""
    def _on_page(canvas, doc):
        canvas.saveState()
        w, h = A4

        # Letterhead band — thin navy strip across the very top of the page
        canvas.setFillColor(NAVY)
        canvas.rect(0, h - 0.35*cm, w, 0.35*cm, stroke=0, fill=1)

        # Brand wordmark, top-right corner
        canvas.setFont(FB, 8)
        canvas.setFillColor(STEEL)
        canvas.drawRightString(w - 2.5*cm, h - 0.9*cm, "ROOMWITNESS")

        # Footer rule + branded footer line
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(2.5*cm, 1.6*cm, w - 2.5*cm, 1.6*cm)

        canvas.setFont(FR, 8)
        canvas.setFillColor(GREY)
        canvas.drawString(2.5*cm, 1.2*cm, f"RoomWitness · คดี {case_id.upper()}")
        canvas.drawCentredString(w / 2, 1.2*cm, page_label)
        canvas.drawRightString(w - 2.5*cm, 1.2*cm, f"หน้า {doc.page}")

        canvas.restoreState()
    return _on_page


# ── Demand Letter ──────────────────────────────────────────────────────────────

def render_demand_letter(sections: dict, context: dict, case_id: str) -> tuple[bytes, int]:
    s = _styles()
    total   = context.get("total_unlawful_thb", 0)
    verdicts = context.get("verdicts", [])
    unlawful = [v for v in verdicts if v.get("verdict") == "UNLAWFUL"]
    today   = datetime.now().strftime("%d %B %Y")
    today_th = datetime.now().strftime("%d/%m/%Y")

    buf = io.BytesIO()
    doc = _doc(buf)
    story = []

    # ── Header ────
    story.append(Paragraph("หนังสือบอกกล่าว / เรียกร้องคืนเงินประกันการเช่า", s["doc_title"]))
    story.append(_hr())
    story.append(Paragraph(f"เลขที่อ้างอิง: RW-{case_id.upper()}", s["doc_subtitle"]))
    story.append(Spacer(1, 0.4*cm))

    # ── Date + recipient ────
    story.append(Paragraph(f"วันที่ {today_th}", s["body_right"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("เรียน &nbsp;&nbsp; เจ้าของทรัพย์สิน / เจ้าของบ้าน", s["body"]))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"<b>เรื่อง:</b> &nbsp; ขอเรียกร้องคืนเงินประกันการเช่า จำนวน <b>{total:,.0f} บาท</b> "
        f"ที่ถูกหักโดยไม่ชอบด้วยกฎหมาย",
        s["body"]
    ))
    story.append(_thin_hr())
    story.append(Spacer(1, 0.2*cm))

    # ── Opening paragraph ────
    story.append(Paragraph(sections.get("opening", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Facts ────
    story.append(Paragraph("ข้อเท็จจริง", s["section_hdr"]))
    story.append(Paragraph(sections.get("facts", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Unlawful claims table ────
    if unlawful:
        story.append(Paragraph("รายการที่ถูกตัดสินว่าไม่ชอบด้วยกฎหมาย", s["section_hdr"]))
        hdr = [
            Paragraph("รายการ", s["table_hdr"]),
            Paragraph("จำนวนเงิน (บาท)", s["table_hdr"]),
            Paragraph("เหตุผล", s["table_hdr"]),
        ]
        rows = [hdr]
        for v in unlawful:
            reason = v.get("reasoning_th", "")
            if len(reason) > 120:
                reason = reason[:117] + "..."
            rows.append([
                Paragraph(v.get("item", ""), s["table_cell"]),
                Paragraph(f"{float(v.get('amount_thb', 0)):,.0f}", s["table_cell_c"]),
                Paragraph(reason, s["small"]),
            ])
        rows.append([
            Paragraph("<b>รวมทั้งสิ้น</b>", s["table_cell"]),
            Paragraph(f"<b>{total:,.0f}</b>", s["table_cell_c"]),
            Paragraph("", s["table_cell"]),
        ])
        tbl = Table(rows, colWidths=[4.5*cm, 3*cm, 9*cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0),  NAVY),
            ("TEXTCOLOR",    (0, 0), (-1, 0),  colors.white),
            ("BACKGROUND",   (0, -1), (-1, -1), NAVY_LT),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, GREY_LT]),
            ("GRID",         (0, 0), (-1, -1), 0.4, GREY),
            ("BOX",          (0, 0), (-1, -1), 1,   NAVY),
            ("FONTNAME",     (0, 0), (-1, -1), FR),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("ALIGN",        (1, 0), (1, -1),  "CENTER"),
            ("TOPPADDING",   (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
            ("LEFTPADDING",  (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 0.4*cm))

    # ── Legal basis ────
    story.append(Paragraph("ฐานทางกฎหมาย", s["section_hdr"]))
    story.append(Paragraph(sections.get("legal_basis", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Demand ────
    story.append(Paragraph("ข้อเรียกร้อง", s["section_hdr"]))
    story.append(Paragraph(sections.get("demand", ""), s["body"]))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"หากไม่ได้รับการตอบรับหรือการดำเนินการที่เหมาะสมภายใน <b>7 วัน</b> นับแต่วันที่ได้รับหนังสือฉบับนี้ "
        f"ข้าพเจ้าจะดำเนินการยื่นร้องเรียนต่อ <b>สำนักงานคณะกรรมการคุ้มครองผู้บริโภค (สคบ.)</b> "
        f"และดำเนินคดีทางแพ่งตามประมวลกฎหมายแพ่งและพาณิชย์ต่อไป",
        s["body"]
    ))
    story.append(Spacer(1, 0.6*cm))
    story.append(_thin_hr())

    # ── Signature block ────
    sig_rows = [
        ["", Paragraph("ขอแสดงความนับถือ", s["sig_label"])],
        ["", Spacer(1, 1.2*cm)],
        ["", Paragraph("____________________________", s["sig_label"])],
        ["", Paragraph("( ผู้เช่า )", s["sig_label"])],
        ["", Paragraph(f"วันที่ {today_th}", s["sig_label"])],
    ]
    sig_tbl = Table(sig_rows, colWidths=[9*cm, 7.5*cm])
    sig_tbl.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), FR)]))
    story.append(sig_tbl)

    # ── Citations footnote ────
    all_cites = []
    for v in verdicts:
        all_cites.extend(v.get("citations", []))
    unique_cites = list(dict.fromkeys(all_cites))
    if unique_cites:
        story.append(Spacer(1, 0.4*cm))
        story.append(_thin_hr())
        story.append(Paragraph("กฎหมายที่อ้างอิง: " + " · ".join(unique_cites), s["small"]))

    story.extend(_disclaimer_block(s))
    canvas_maker = _page_num_canvas_maker("หนังสือเรียกร้องคืนเงินประกันการเช่า", case_id)
    doc.build(story, onFirstPage=canvas_maker, onLaterPages=canvas_maker)
    return buf.getvalue(), doc.page


# ── Evidence Summary ───────────────────────────────────────────────────────────

def render_evidence_summary(sections: dict, context: dict, case_id: str) -> tuple[bytes, int]:
    s = _styles()
    total_claimed  = sum(float(v.get("amount_thb", 0)) for v in context.get("verdicts", []))
    total_unlawful = context.get("total_unlawful_thb", 0)
    verdicts       = context.get("verdicts", [])
    pct = round(total_unlawful / total_claimed * 100) if total_claimed else 0
    today_th = datetime.now().strftime("%d/%m/%Y")

    buf = io.BytesIO()
    doc = _doc(buf)
    story = []

    # ── Header ────
    story.append(Paragraph("สรุปหลักฐานและผลการวินิจฉัยคดี", s["doc_title"]))
    story.append(_hr())
    story.append(Paragraph(f"เลขที่อ้างอิง: RW-{case_id.upper()}  ·  วันที่ {today_th}", s["doc_subtitle"]))
    story.append(Spacer(1, 0.5*cm))

    # ── Stat boxes (flat 3-column table, fits within 16 cm usable width) ────
    stat_label = ParagraphStyle("sl", fontName=FR, fontSize=8, textColor=STEEL, alignment=TA_CENTER)
    stat_value = ParagraphStyle("sv", fontName=FB, fontSize=14, textColor=NAVY, alignment=TA_CENTER)
    boxes = Table([[
        Paragraph("ยอดรวมที่ถูกเรียกร้อง", stat_label),
        Paragraph("ยอดที่ไม่ชอบด้วยกฎหมาย", stat_label),
        Paragraph("สัดส่วน", stat_label),
    ], [
        Paragraph(f"฿{total_claimed:,.0f}", stat_value),
        Paragraph(f"฿{total_unlawful:,.0f}", stat_value),
        Paragraph(f"{pct}%", stat_value),
    ]], colWidths=[5.3*cm, 5.3*cm, 5.3*cm])
    boxes.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (0, -1), NAVY_LT),
        ("BACKGROUND",   (1, 0), (1, -1), RED_BG),
        ("BACKGROUND",   (2, 0), (2, -1), GREEN_BG),
        ("BOX",          (0, 0), (0, -1), 1, STEEL),
        ("BOX",          (1, 0), (1, -1), 1, STEEL),
        ("BOX",          (2, 0), (2, -1), 1, STEEL),
        ("LINEAFTER",    (0, 0), (1, -1), 1, colors.white),
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(boxes)
    story.append(Spacer(1, 0.5*cm))

    # ── Overview ────
    story.append(Paragraph("ภาพรวมคดี", s["section_hdr"]))
    story.append(Paragraph(sections.get("overview", ""), s["body"]))

    story.append(Paragraph("วิธีการตรวจสอบ", s["section_hdr"]))
    story.append(Paragraph(sections.get("analysis", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Verdict table ────
    if verdicts:
        story.append(Paragraph("ผลการวินิจฉัยแต่ละรายการ", s["section_hdr"]))
        hdr = [
            Paragraph("รายการ", s["table_hdr"]),
            Paragraph("จำนวนเงิน", s["table_hdr"]),
            Paragraph("ผลตัดสิน", s["table_hdr"]),
            Paragraph("เหตุผลโดยสรุป", s["table_hdr"]),
            Paragraph("กฎหมายอ้างอิง", s["table_hdr"]),
        ]
        rows = [hdr]
        for v in verdicts:
            verdict = v.get("verdict", "DISPUTED")
            vbadge = Paragraph(
                _VERDICT_LABEL.get(verdict, verdict),
                _verdict_badge_style(verdict, s)
            )
            reason = v.get("reasoning_th", "")
            if len(reason) > 100:
                reason = reason[:97] + "..."
            cites = ", ".join(v.get("citations", []))
            if len(cites) > 60:
                cites = cites[:57] + "..."
            rows.append([
                Paragraph(v.get("item", ""), s["table_cell"]),
                Paragraph(f"฿{float(v.get('amount_thb', 0)):,.0f}", s["table_cell_c"]),
                vbadge,
                Paragraph(reason, s["small"]),
                Paragraph(cites, s["small"]),
            ])
        tbl = Table(rows, colWidths=[3*cm, 2.2*cm, 3.2*cm, 4.8*cm, 3.3*cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0),  NAVY),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LT]),
            ("GRID",         (0, 0), (-1, -1), 0.4, GREY),
            ("BOX",          (0, 0), (-1, -1), 1,   NAVY),
            ("FONTNAME",     (0, 0), (-1, -1), FR),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("TOPPADDING",   (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
            ("LEFTPADDING",  (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 0.4*cm))

    # ── Recommendations ────
    story.append(Paragraph("ข้อแนะนำ", s["section_hdr"]))
    story.append(Paragraph(sections.get("recommendation", ""), s["body"]))

    # ── Case summary ────
    summary = context.get("case_summary_en", "")
    if summary:
        story.append(Spacer(1, 0.3*cm))
        story.append(_thin_hr())
        story.append(Paragraph(f"<i>Case summary (EN): {summary}</i>", s["small"]))

    story.extend(_disclaimer_block(s))
    canvas_maker = _page_num_canvas_maker("สรุปหลักฐานและผลการวินิจฉัยคดี", case_id)
    doc.build(story, onFirstPage=canvas_maker, onLaterPages=canvas_maker)
    return buf.getvalue(), doc.page


# ── OCPB Complaint ─────────────────────────────────────────────────────────────

def render_ocpb_complaint(sections: dict, context: dict, case_id: str) -> tuple[bytes, int]:
    s = _styles()
    total    = context.get("total_unlawful_thb", 0)
    verdicts = context.get("verdicts", [])
    unlawful = [v for v in verdicts if v.get("verdict") == "UNLAWFUL"]
    today_th = datetime.now().strftime("%d/%m/%Y")

    buf = io.BytesIO()
    doc = _doc(buf)
    story = []

    # ── OCPB Header ────
    story.append(Paragraph("สำนักงานคณะกรรมการคุ้มครองผู้บริโภค (สคบ.)", s["doc_title"]))
    story.append(Paragraph("หนังสือร้องเรียน", ParagraphStyle(
        "_", fontName=FB, fontSize=13, alignment=TA_CENTER, textColor=STEEL, spaceAfter=2)))
    story.append(_hr())
    story.append(Paragraph(f"เลขที่: RW-OCPB-{case_id.upper()}  ·  วันที่ {today_th}", s["doc_subtitle"]))
    story.append(Spacer(1, 0.5*cm))

    # ── Party info boxes ────
    info_data = [
        [Paragraph("<b>ผู้ร้องเรียน (ผู้เช่า)</b>", s["label"]),
         Paragraph("<b>ผู้ถูกร้องเรียน (เจ้าของบ้าน)</b>", s["label"])],
        [Paragraph("ชื่อ: ……………………………………………\nที่อยู่: ……………………………………………\nโทร: ……………………………………………", s["body"]),
         Paragraph("ชื่อ: ……………………………………………\nที่อยู่: ……………………………………………\nโทร: ……………………………………………", s["body"])],
    ]
    info_tbl = Table(info_data, colWidths=[8*cm, 8*cm])
    info_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (0, 0), NAVY_LT),
        ("BACKGROUND",   (1, 0), (1, 0), NAVY_LT),
        ("BOX",          (0, 0), (0, -1), 1, STEEL),
        ("BOX",          (1, 0), (1, -1), 1, STEEL),
        ("LINEAFTER",    (0, 0), (0, -1), 1, GREY),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("FONTNAME",     (0, 0), (-1, -1), FR),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 0.4*cm))

    # ── Subject ────
    story.append(Paragraph(
        f"<b>เรื่อง:</b> &nbsp; ร้องเรียนเจ้าของบ้านหักเงินประกันการเช่า <b>{total:,.0f} บาท</b> "
        f"โดยไม่ชอบด้วยกฎหมายตามประกาศ สคบ. พ.ศ. 2568 และ ป.พ.พ. มาตรา 537-571",
        s["body"]
    ))
    story.append(_thin_hr())
    story.append(Spacer(1, 0.2*cm))

    # ── Intro ────
    story.append(Paragraph(sections.get("intro", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Facts ────
    story.append(Paragraph("ข้อเท็จจริงและพฤติการณ์", s["section_hdr"]))
    story.append(Paragraph(sections.get("facts", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Unlawful items table ────
    if unlawful:
        story.append(Paragraph("รายการที่ถูกตัดสินว่าไม่ชอบด้วยกฎหมาย", s["section_hdr"]))
        hdr = [Paragraph("รายการ", s["table_hdr"]),
               Paragraph("จำนวนเงิน (บาท)", s["table_hdr"]),
               Paragraph("เหตุผลทางกฎหมาย", s["table_hdr"])]
        rows = [hdr]
        for v in unlawful:
            reason = v.get("reasoning_th", "")
            if len(reason) > 100:
                reason = reason[:97] + "..."
            rows.append([
                Paragraph(v.get("item", ""), s["table_cell"]),
                Paragraph(f"{float(v.get('amount_thb', 0)):,.0f}", s["table_cell_c"]),
                Paragraph(reason, s["small"]),
            ])
        rows.append([Paragraph("<b>รวม</b>", s["table_cell"]),
                     Paragraph(f"<b>{total:,.0f}</b>", s["table_cell_c"]),
                     Paragraph("", s["table_cell"])])
        tbl = Table(rows, colWidths=[4*cm, 3*cm, 9.5*cm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0),  NAVY),
            ("BACKGROUND",   (0, -1), (-1, -1), NAVY_LT),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, GREY_LT]),
            ("GRID",         (0, 0), (-1, -1), 0.4, GREY),
            ("BOX",          (0, 0), (-1, -1), 1,   NAVY),
            ("FONTNAME",     (0, 0), (-1, -1), FR),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("TOPPADDING",   (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
            ("LEFTPADDING",  (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 0.4*cm))

    # ── Relief ────
    story.append(Paragraph("คำขอให้ดำเนินการ", s["section_hdr"]))
    story.append(Paragraph(sections.get("relief", ""), s["body"]))
    story.append(Spacer(1, 0.3*cm))

    # ── Attachments ────
    story.append(Paragraph("เอกสารประกอบการร้องเรียน", s["section_hdr"]))
    attachments = [
        "☐  สัญญาเช่า",
        "☐  หลักฐานการชำระเงินประกัน",
        "☐  ภาพถ่ายสภาพห้องพักตอนเข้าอยู่ (Move-in)",
        "☐  ภาพถ่ายสภาพห้องพักตอนออก (Move-out)",
        "☐  หนังสือแจ้งรายการหักเงินจากเจ้าของบ้าน",
        "☐  เอกสารอื่นๆ ที่เกี่ยวข้อง",
    ]
    for att in attachments:
        story.append(Paragraph(att, s["body"]))
    story.append(Spacer(1, 0.6*cm))
    story.append(_thin_hr())

    # ── Signature ────
    sig_rows = [
        ["", Paragraph("ลงชื่อ ผู้ร้องเรียน", s["sig_label"])],
        ["", Spacer(1, 1.0*cm)],
        ["", Paragraph("____________________________", s["sig_label"])],
        ["", Paragraph("( ผู้เช่า )", s["sig_label"])],
        ["", Paragraph(f"วันที่ {today_th}", s["sig_label"])],
    ]
    sig_tbl = Table(sig_rows, colWidths=[9*cm, 7.5*cm])
    sig_tbl.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), FR)]))
    story.append(sig_tbl)

    story.extend(_disclaimer_block(s))
    canvas_maker = _page_num_canvas_maker("หนังสือร้องเรียนต่อ สคบ.", case_id)
    doc.build(story, onFirstPage=canvas_maker, onLaterPages=canvas_maker)
    return buf.getvalue(), doc.page


# ── Dispatch ──────────────────────────────────────────────────────────────────

_RENDERERS = {
    "demand_letter":    render_demand_letter,
    "evidence_summary": render_evidence_summary,
    "ocpb_complaint":   render_ocpb_complaint,
}


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "agent": "04"}


@app.post("/api/v1/agent04")
async def run_agent04(request: Request):
    data = await request.json()

    # Responsible AI: documents are only generated once the tenant has
    # reviewed the legal verdicts and explicitly approved (enforced here, not
    # just gated in the UI — a direct API call without approval is rejected).
    if data.get("approved_by_tenant") is not True:
        raise HTTPException(status_code=400, detail="approved_by_tenant must be true to generate documents")

    docs_to_generate: list[str] = data.get("documents_to_generate", ["demand_letter", "evidence_summary"])
    total_unlawful: float       = float(data.get("total_unlawful_thb", 0))
    verdicts: list              = data.get("verdicts", [])
    case_summary_th: str        = data.get("case_summary_th", "")
    case_summary_en: str        = data.get("case_summary_en", "")
    claims: list                = data.get("claims", [])

    case_id = uuid.uuid4().hex[:10]
    start   = time.perf_counter()
    llm     = _get_llm()

    context = {
        "total_unlawful_thb": total_unlawful,
        "verdicts":       verdicts,
        "case_summary_th": case_summary_th,
        "case_summary_en": case_summary_en,
        "claims":         claims,
        "generated_date": datetime.now().strftime("%d/%m/%Y"),
    }

    documents: dict = {}

    for doc_type in docs_to_generate:
        if doc_type not in DOC_META:
            logger.warning("Unknown doc_type '%s' — skipping", doc_type)
            continue

        renderer = _RENDERERS.get(doc_type)
        if renderer is None:
            continue

        sections = _generate_sections(doc_type, context, llm)

        try:
            pdf_bytes, page_count = renderer(sections, context, case_id)
        except Exception as exc:
            logger.exception("Render failed for %s: %s", doc_type, exc)
            continue

        out_dir  = OUTPUTS_DIR / case_id
        out_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = out_dir / f"{doc_type}.pdf"
        pdf_path.write_bytes(pdf_bytes)
        logger.info("Saved %s (%d pages, %d B)", pdf_path.name, page_count, len(pdf_bytes))

        documents[doc_type] = {
            "doc_type":     DOC_META[doc_type]["doc_type"],
            "pages":        page_count,
            "status":       "generated",
            "download_url": f"/api/v1/download/{case_id}/{doc_type}",
        }

    _write_audit_record(case_id, context, documents, docs_to_generate)

    elapsed = round(time.perf_counter() - start, 2)
    return {
        "case_id":                  case_id,
        "documents":                documents,
        "generation_time_seconds":  elapsed,
        "total_unlawful_amount_thb": total_unlawful,
    }


@app.get("/api/v1/download/{case_id}/{doc_type}")
def download_document(case_id: str, doc_type: str):
    if any(c in case_id + doc_type for c in ("/", "\\", "..")):
        raise HTTPException(status_code=400, detail="Invalid parameters")
    pdf_path = OUTPUTS_DIR / case_id / f"{doc_type}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"{doc_type}_{case_id}.pdf",
        headers={"Content-Disposition": f'attachment; filename="{doc_type}_{case_id}.pdf"'},
    )
