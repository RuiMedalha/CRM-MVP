#!/usr/bin/env python3
"""
Backfill: Identifica contactos para email_threads e conversations sem contact_id/lead_id.
Usa a API Directus directamente (mesma logica que /apply-contact-identification).

Regras:
- Email: procura em email, contact_email, email_compras, email_comercial, email_encomendas
- Phone: normaliza para ultimos 9 digitos, procura em phone, mobile_phone, whatsapp_number, contact_phone
- Prioridade: contacto > lead
- Ambiguidade (2+ contactos): marca needs_review=true

Usage:
  python scripts/backfill-contact-identification.py --dry-run   # simulacao, sem escrever nada
  python scripts/backfill-contact-identification.py             # execucao real (requer backup commitado)
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

DIRECTUS_URL = "https://api.hotelequip.pt"
TOKEN = "bZ98ZV_nHEvYt1J7jcoXzp0quyRkYqR8y19yPueBHcw"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# --- Mode ---
DRY_RUN = "--dry-run" in sys.argv

# --- Stats ---
stats = {
    "threads_total": 0,
    "threads_matched_email": 0,
    "threads_matched_phone": 0,
    "threads_matched_lead": 0,
    "threads_ambiguous": 0,
    "threads_no_match": 0,
    "convs_total": 0,
    "convs_matched_phone": 0,
    "convs_matched_email": 0,
    "convs_matched_lead": 0,
    "convs_ambiguous": 0,
    "convs_no_match": 0,
}

examples = []  # Store 5 examples for A3


def api_get(path):
    url = f"{DIRECTUS_URL}{path}"
    if '?' in url:
        base, qs = url.split('?', 1)
        qs = qs.replace('[', '%5B').replace(']', '%5D')
        url = f"{base}?{qs}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  [api_get ERROR] HTTP {e.code}: {body[:100]}")
        return None
    except Exception as e:
        print(f"  [api_get ERROR] {e}")
        return None


def api_patch(path, body):
    if DRY_RUN:
        return {"dry_run": True}
    url = f"{DIRECTUS_URL}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [PATCH ERROR] {path}: {e}")
        return None


def normalize_phone(raw):
    digits = re.sub(r"\D", "", str(raw or ""))
    return digits[-9:] if len(digits) >= 9 else ""


def normalize_email(raw):
    return str(raw or "").strip().lower()


def find_contact_by_email(email):
    norm = normalize_email(email)
    if not norm or "@" not in norm:
        return None, None
    fields_to_search = ["email", "contact_email", "email_compras", "email_comercial", "email_encomendas"]
    for field in fields_to_search:
        encoded = urllib.parse.quote(norm)
        result = api_get(f"/items/contacts?filter[{field}][_eq]={encoded}&filter[entity_status][_neq]=archived&limit=2&fields=id,company_name,contact_name,phone")
        if result and result.get("data"):
            if len(result["data"]) == 1:
                return result["data"][0], field
            elif len(result["data"]) > 1:
                return "AMBIGUOUS", field
    return None, None


def find_contact_by_phone(phone):
    tail = normalize_phone(phone)
    if len(tail) < 9:
        return None, None
    fields_to_search = ["phone", "mobile_phone", "whatsapp_number", "contact_phone"]
    for field in fields_to_search:
        result = api_get(f"/items/contacts?filter[{field}][_ends_with]={tail}&filter[entity_status][_neq]=archived&limit=2&fields=id,company_name,contact_name,phone")
        if result and result.get("data"):
            if len(result["data"]) == 1:
                return result["data"][0], field
            elif len(result["data"]) > 1:
                return "AMBIGUOUS", field
    return None, None


def find_lead_by_email(email):
    norm = normalize_email(email)
    if not norm:
        return None
    encoded = urllib.parse.quote(norm)
    for field in ["email", "contact_email"]:
        result = api_get(f"/items/leads?filter[{field}][_eq]={encoded}&filter[status][_neq]=discarded&limit=1&fields=id,display_name")
        if result and result.get("data"):
            return result["data"][0]
    return None


def find_lead_by_phone(phone):
    tail = normalize_phone(phone)
    if len(tail) < 9:
        return None
    for field in ["phone", "whatsapp_number", "contact_phone"]:
        result = api_get(f"/items/leads?filter[{field}][_ends_with]={tail}&filter[status][_neq]=discarded&limit=1&fields=id,display_name")
        if result and result.get("data"):
            return result["data"][0]
    return None


def extract_phone_from_source(source):
    if not source:
        return ""
    meta_match = re.match(r"^meta:[^:]+:(\d{7,15})$", source)
    if meta_match:
        return meta_match.group(1)
    phone = re.sub(r"@.*$", "", source).strip()
    digits = re.sub(r"\D", "", phone)
    return digits if len(digits) >= 9 else ""


def process_thread(thread):
    from_addr = thread.get("from_address", "")
    thread_id = thread["id"]
    if thread.get("contact_id") or thread.get("lead_id"):
        return
    stats["threads_total"] += 1

    contact, field = find_contact_by_email(from_addr)
    if contact == "AMBIGUOUS":
        stats["threads_ambiguous"] += 1
        api_patch(f"/items/email_threads/{thread_id}", {"needs_review": True})
        return
    if contact:
        contact_name = contact.get("company_name") or contact.get("contact_name") or ""
        api_patch(f"/items/email_threads/{thread_id}", {
            "contact_id": contact["id"],
            "needs_review": False,
        })
        stats["threads_matched_email"] += 1
        if len(examples) < 5:
            examples.append({"type": "email_thread", "id": thread_id, "from": from_addr, "contact_id": contact["id"], "contact_name": contact_name, "matched_by": field})
        return

    lead = find_lead_by_email(from_addr)
    if lead:
        api_patch(f"/items/email_threads/{thread_id}", {
            "lead_id": lead["id"],
            "needs_review": False,
        })
        stats["threads_matched_lead"] += 1
        return

    stats["threads_no_match"] += 1


def process_conversation(conv):
    source = conv.get("source", "")
    conv_id = conv["id"]
    if conv.get("contact_id") or conv.get("lead_id"):
        return
    stats["convs_total"] += 1

    phone = extract_phone_from_source(source)
    if not phone:
        stats["convs_no_match"] += 1
        return

    contact, field = find_contact_by_phone(phone)
    if contact == "AMBIGUOUS":
        stats["convs_ambiguous"] += 1
        api_patch(f"/items/conversations/{conv_id}", {"needs_review": True})
        return
    if contact:
        contact_name = contact.get("company_name") or contact.get("contact_name") or ""
        api_patch(f"/items/conversations/{conv_id}", {
            "contact_id": contact["id"],
            "customer_name": contact_name,
            "needs_review": False,
        })
        stats["convs_matched_phone"] += 1
        if len(examples) < 5:
            examples.append({"type": "conversation", "id": conv_id, "source": source, "phone": phone, "contact_id": contact["id"], "contact_name": contact_name, "matched_by": field})
        return

    lead = find_lead_by_phone(phone)
    if lead:
        api_patch(f"/items/conversations/{conv_id}", {
            "lead_id": lead["id"],
            "needs_review": False,
        })
        stats["convs_matched_lead"] += 1
        return

    stats["convs_no_match"] += 1


def save_backup(threads, convs):
    """Grava backup completo dos registos que vao ser alterados."""
    backup_path = "docs/backups/backfill_pre_identificacao_2026-07-16.json"
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)
    backup = {
        "date": "2026-07-16",
        "description": "Backup antes do backfill de identificacao automatica",
        "email_threads": threads,
        "conversations": convs,
    }
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False, indent=2)
    print(f"  Backup gravado: {backup_path} ({len(threads)} threads + {len(convs)} convs)")
    return backup_path


def main():
    mode = "DRY-RUN (simulacao, sem escrita)" if DRY_RUN else "EXECUCAO REAL (vai escrever na BD)"
    print("=" * 60)
    print(f"BACKFILL: Identificacao automatica de contactos [{mode}]")
    print("=" * 60)
    print()

    # 1. Get all threads without contact_id or lead_id
    print("[1/5] A buscar email_threads sem identificacao...")
    threads_data = api_get("/items/email_threads?filter[contact_id][_null]=true&filter[lead_id][_null]=true&limit=500&fields=id,from_address,contact_id,lead_id,subject&sort=-date_created")
    threads = threads_data.get("data", []) if threads_data else []
    print(f"  -> {len(threads)} threads a processar")

    # 2. Get all WHATSAPP conversations without contact_id or lead_id
    # Filtrar por channel=whatsapp para excluir ask_me (chatbot) que nao tem telefone
    print("[2/5] A buscar conversations WhatsApp sem identificacao...")
    convs_data = api_get("/items/conversations?filter[contact_id][_null]=true&filter[lead_id][_null]=true&filter[channel][_eq]=whatsapp&limit=500&fields=id,source,customer_name,contact_id,lead_id,channel&sort=-updated_at")
    convs = convs_data.get("data", []) if convs_data else []
    print(f"  -> {len(convs)} conversas WhatsApp a processar")

    if not threads and not convs:
        print("\n  Nada a processar. Verifica filtros ou dados.")
        return

    # 3. Backup (antes de qualquer PATCH)
    print()
    print("[3/5] A gravar backup completo...")
    # Fetch with all fields for backup
    threads_full = api_get("/items/email_threads?filter[contact_id][_null]=true&filter[lead_id][_null]=true&limit=500&fields=*&sort=-date_created")
    # Backup WhatsApp only (ask_me nao tem identificacao via telefone)
    convs_full = api_get("/items/conversations?filter[contact_id][_null]=true&filter[lead_id][_null]=true&filter[channel][_eq]=whatsapp&limit=500&fields=*&sort=-updated_at")
    backup_path = save_backup(
        threads_full.get("data", []) if threads_full else [],
        convs_full.get("data", []) if convs_full else [],
    )

    # 4. Process threads
    print()
    print("[4/5] A processar email_threads...")
    for i, thread in enumerate(threads):
        if i % 50 == 0 and i > 0:
            print(f"  ... {i}/{len(threads)} processadas")
            time.sleep(0.5)
        process_thread(thread)
        time.sleep(0.1)

    # 5. Process conversations
    print()
    print("[5/5] A processar conversations...")
    for i, conv in enumerate(convs):
        if i % 50 == 0 and i > 0:
            print(f"  ... {i}/{len(convs)} processadas")
            time.sleep(0.5)
        process_conversation(conv)
        time.sleep(0.1)

    # 6. Report
    print()
    print("=" * 60)
    print(f"RELATORIO DE BACKFILL [{mode}]")
    print("=" * 60)
    print()
    print("--- EMAIL THREADS ---")
    print(f"  Total processadas: {stats['threads_total']}")
    print(f"  Ligadas por email: {stats['threads_matched_email']}")
    print(f"  Ligadas por telefone: {stats['threads_matched_phone']}")
    print(f"  Ligadas a lead: {stats['threads_matched_lead']}")
    print(f"  Ambiguas (needs_review): {stats['threads_ambiguous']}")
    print(f"  Sem correspondencia: {stats['threads_no_match']}")
    total_matched_threads = stats['threads_matched_email'] + stats['threads_matched_phone'] + stats['threads_matched_lead']
    if stats['threads_total'] > 0:
        print(f"  Taxa de identificacao: {total_matched_threads}/{stats['threads_total']} ({100*total_matched_threads/stats['threads_total']:.1f}%)")

    print()
    print("--- CONVERSATIONS (WhatsApp) ---")
    print(f"  Total processadas: {stats['convs_total']}")
    print(f"  Ligadas por telefone: {stats['convs_matched_phone']}")
    print(f"  Ligadas por email: {stats['convs_matched_email']}")
    print(f"  Ligadas a lead: {stats['convs_matched_lead']}")
    print(f"  Ambiguas (needs_review): {stats['convs_ambiguous']}")
    print(f"  Sem correspondencia: {stats['convs_no_match']}")
    total_matched_convs = stats['convs_matched_phone'] + stats['convs_matched_email'] + stats['convs_matched_lead']
    if stats['convs_total'] > 0:
        print(f"  Taxa de identificacao: {total_matched_convs}/{stats['convs_total']} ({100*total_matched_convs/stats['convs_total']:.1f}%)")

    print()
    print("--- EXEMPLOS DE LIGACOES CORRECTAS (A3) ---")
    for i, ex in enumerate(examples[:5], 1):
        if ex["type"] == "email_thread":
            print(f"  {i}. Thread {ex['id'][:8]}... from={ex['from']} -> contact {ex['contact_name']} (matched by {ex['matched_by']})")
        else:
            print(f"  {i}. Conv {ex['id'][:8]}... source={ex['source']} phone={ex['phone']} -> contact {ex['contact_name']} (matched by {ex['matched_by']})")

    print()
    print(json.dumps(stats, indent=2))
    print()
    if DRY_RUN:
        print("** DRY-RUN: nenhuma escrita foi feita. Para executar a serio: python scripts/backfill-contact-identification.py **")
    else:
        print(f"DONE. Backup em: {backup_path}")


if __name__ == "__main__":
    main()
