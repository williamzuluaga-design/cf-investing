#!/usr/bin/env python3
import hashlib
import html
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public/data/discovery-sources.json"
QUEUE = ROOT / "public/data/discovery-queue.json"
PROJECTS = ROOT / "public/data/projects.json"
REVIEW_MD = Path("/tmp/source-discovery-review.md")
UA = "CFInvestingSourceDiscovery/1.2 (+https://cfinvesting.com/projects/methodology/)"
MAX_DOWNLOAD = 50_000_000

MONTHS_ES = {
    "enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
    "julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,
    "noviembre":11,"diciembre":12
}
COUNTRIES = {
    "argentina","bahamas","barbados","bolivia","brasil","chile","colombia",
    "costa rica","ecuador","el salvador","granada","honduras","jamaica","mexico",
    "panama","paraguay","peru","portugal","republica dominicana","trinidad y tobago",
    "uruguay","venezuela","caribe","regional","espana","europa","antigua y barbuda"
}
GENERIC_LINK_TEXT = {"ver detalle","ver mas","ver más","conocer mas","conocer más","detalle","leer mas","leer más"}


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value):
    value = html.unescape(value or "")
    return re.sub(r"\s+", " ", value).strip()


def ascii_text(value):
    value = unicodedata.normalize("NFKD", clean_text(value))
    value = "".join(c for c in value if not unicodedata.combining(c))
    return value.lower()


def ascii_key(value):
    return re.sub(r"[^a-z0-9]+", "", ascii_text(value))


def canonical(url):
    p = urllib.parse.urlsplit(url or "")
    path = re.sub(r"/{2,}", "/", p.path or "/")
    if path != "/":
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), path, "", ""))


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def save_json(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_bytes(url, accept="*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=35) as resp:
        raw = resp.read(MAX_DOWNLOAD + 1)
        if len(raw) > MAX_DOWNLOAD:
            raise RuntimeError("Source response exceeded download safety limit")
        return raw, resp.headers.get("Content-Type", "")


def fetch_html(url):
    raw, content_type = fetch_bytes(url, "text/html,application/xhtml+xml")
    if "html" not in content_type.lower() and not raw.lstrip().startswith(b"<"):
        raise RuntimeError(f"Unexpected content type: {content_type}")
    return raw.decode("utf-8", errors="replace")


class PageParser(HTMLParser):
    BLOCKS = {"p","div","article","section","li","h1","h2","h3","h4","h5","br","dt","dd","tr","td"}
    def __init__(self):
        super().__init__()
        self.links = []
        self.lines = []
        self.current_href = None
        self.current_link_text = []
        self.buffer = []

    def flush(self):
        text = clean_text(" ".join(self.buffer))
        if text:
            self.lines.append(text)
        self.buffer = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in self.BLOCKS:
            self.flush()
        if tag == "a":
            attrs = dict(attrs)
            self.current_href = attrs.get("href")
            self.current_link_text = []

    def handle_data(self, data):
        text = clean_text(data)
        if not text:
            return
        self.buffer.append(text)
        if self.current_href is not None:
            self.current_link_text.append(text)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "a" and self.current_href is not None:
            self.links.append((self.current_href, clean_text(" ".join(self.current_link_text))))
            self.current_href = None
            self.current_link_text = []
        if tag in self.BLOCKS:
            self.flush()

    def close(self):
        super().close()
        self.flush()


def parse_page(url):
    parser = PageParser()
    parser.feed(fetch_html(url))
    parser.close()
    return parser


def absolute_candidate(source, href):
    if not href or href.startswith(("mailto:","tel:","javascript:","#")):
        return None
    absolute = urllib.parse.urljoin(source["url"], href)
    parsed = urllib.parse.urlsplit(absolute)
    base_host = urllib.parse.urlsplit(source["url"]).netloc.lower()
    if parsed.scheme not in ("http","https") or parsed.netloc.lower() != base_host:
        return None
    prefixes = source.get("include_path_prefixes", [])
    if prefixes and not any(parsed.path.startswith(p) and parsed.path.rstrip("/") != p.rstrip("/") for p in prefixes):
        return None
    return canonical(absolute)


def title_from_link(url, text):
    text = clean_text(text)
    if text and ascii_text(text) not in GENERIC_LINK_TEXT and len(text) >= 5:
        return text
    slug = urllib.parse.urlsplit(url).path.rstrip("/").split("/")[-1]
    return clean_text(slug.replace("-", " ").replace("_", " ").title())


def find_line(lines, title):
    key = ascii_text(title)
    probes = [key, key[:70], key[:45]]
    for probe in probes:
        if len(probe) < 8:
            continue
        for i, line in enumerate(lines):
            if probe in ascii_text(line) or ascii_text(line) in probe:
                return i
    return None


def nearby(lines, index, before=4, after=20):
    if index is None:
        return []
    return lines[max(0,index-before):min(len(lines),index+after+1)]


def first_regex(text, pattern, flags=re.I):
    m = re.search(pattern, text, flags)
    return clean_text(m.group(1)) if m else ""


def parse_date(value):
    value = clean_text(value)
    if not value:
        return None
    for fmt in ("%Y-%m-%d","%d/%m/%Y","%m/%d/%Y","%Y/%m/%d"):
        try:
            return datetime.strptime(value[:10], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    low = ascii_text(value)
    m = re.search(r"(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(20\d{2})", low)
    if not m:
        m = re.search(r"(\d{1,2})\s+([a-z]+)\s+(20\d{2})", low)
    if m and m.group(2) in MONTHS_ES:
        try:
            return datetime(int(m.group(3)), MONTHS_ES[m.group(2)], int(m.group(1)), tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def date_in_scope(source, value):
    since = parse_date(source.get("published_since", ""))
    if not since:
        return True
    dt = parse_date(value)
    return dt is not None and dt >= since


def country_in_scope(source, country):
    scope = source.get("country_scope", [])
    return not scope or ascii_key(country) in {ascii_key(x) for x in scope}


def discover_html(source):
    parser = parse_page(source["url"])
    seen, items = set(), []
    for href, text in parser.links:
        url = absolute_candidate(source, href)
        if not url or url in seen:
            continue
        seen.add(url)
        items.append({"title":title_from_link(url,text),"url":url,"metadata":{},"connector":"html_catalog","discovery_key":f"{source['id']}|url|{url}"})
        if len(items) >= int(source.get("max_candidates_per_run",30)):
            break
    return items, {"records_scanned":len(parser.links),"structured":False}


XML_ALIASES = {
    "title":{"projectname","projecttitle","title","name","project"},
    "number":{"projectnumber","projectno","projectid","projectcode","number","projectnumbervalue"},
    "country":{"country","countryname","countries"},
    "published":{"publicationdate","dateposted","projectdateposted","disclosuredate","postingdate","publisheddate","datepublished"},
    "sector":{"sector","sectorname"},"status":{"status","projectstatus","projectstatusvalue"},
    "category":{"escategory","environmentalsocialcategory","category"},
    "url":{"url","link","projecturl","projectlink","href"},
    "amount":{"amount","financedamount","financingamount","projectamount","amountfinanced"},
    "client":{"client","sponsor","borrower","company","clientname"}
}

def xml_key(tag):
    return ascii_key(tag.split("}")[-1].split(":")[-1])

def flatten_xml(node):
    fields, leaves = {}, 0
    for e in node.iter():
        for k,v in e.attrib.items():
            if clean_text(v): fields.setdefault(xml_key(k),[]).append(clean_text(v))
        if not list(e) and clean_text(e.text):
            leaves += 1
            fields.setdefault(xml_key(e.tag),[]).append(clean_text(e.text))
    return fields, leaves

def pick(fields, kind):
    for alias in XML_ALIASES[kind]:
        for v in fields.get(ascii_key(alias),[]):
            if clean_text(v): return clean_text(v)
    return ""

def discover_idbinvest_xml(source):
    raw, content_type = fetch_bytes(source["structured_url"], "application/xml,text/xml;q=0.9,*/*;q=0.1")
    root = ET.fromstring(raw)
    found = {}
    scanned = 0
    for node in root.iter():
        fields, leaf_count = flatten_xml(node)
        if leaf_count < 2 or leaf_count > 80: continue
        title, number = pick(fields,"title"), pick(fields,"number")
        if not title or not number: continue
        scanned += 1
        country, published = pick(fields,"country"), pick(fields,"published")
        if not country_in_scope(source,country) or not date_in_scope(source,published): continue
        identity = ascii_key(number)
        if identity in found: continue
        raw_url = pick(fields,"url")
        if raw_url:
            url = urllib.parse.urljoin(source["url"],raw_url)
        else:
            url = source["url"] + "?" + urllib.parse.urlencode({"field_project_number_value":number})
        meta = {"project_number":number,"country":country,"publication_date":published,"sector":pick(fields,"sector"),"status":pick(fields,"status"),"es_category":pick(fields,"category"),"amount":pick(fields,"amount"),"client_or_sponsor":pick(fields,"client")}
        found[identity] = {"title":title,"url":url,"metadata":{k:v for k,v in meta.items() if v},"connector":"idbinvest_xml","discovery_key":f"{source['id']}|project-number|{identity}"}
    items = list(found.values())
    items.sort(key=lambda x:(parse_date(x["metadata"].get("publication_date","")) or datetime(1970,1,1,tzinfo=timezone.utc)), reverse=True)
    return items[:int(source.get("max_candidates_per_run",60))], {"records_scanned":scanned,"structured":True,"eligible_records":len(items),"endpoint":source["structured_url"],"content_type":content_type}


def caf_page_url(base, page):
    sep = "&" if "?" in base else "?"
    return base if page == 0 else f"{base}{sep}page={page}"


def discover_caf(source):
    found = {}
    pages_checked = 0
    records_scanned = 0
    for page in range(int(source.get("max_pages",6))):
        parser = parse_page(caf_page_url(source["url"],page))
        pages_checked += 1
        records_scanned += len(parser.links)
        for href, text in parser.links:
            url = absolute_candidate(source,href)
            if not url: continue
            title = title_from_link(url,text)
            idx = find_line(parser.lines,title)
            block = nearby(parser.lines,idx,5,22)
            joined = " | ".join(block)
            country = ""
            if idx is not None:
                for line in reversed(parser.lines[max(0,idx-5):idx]):
                    if ascii_text(line) in COUNTRIES:
                        country = line; break
            op = first_regex(joined,r"Número de operación:\s*([A-Z0-9-]+)")
            approval = first_regex(joined,r"Fecha de aprobación:\s*([^|]+?)(?:\s*\(actualizado|\s*\||$)")
            updated = first_regex(joined,r"actualizado\s+([^\)]+)\)")
            risk = first_regex(joined,r"Tipo de riesgo:\s*([^|]+)")
            instrument = first_regex(joined,r"Instrumento de financiación:\s*([^|]+)")
            sector = first_regex(joined,r"Sector:\s*([^|]+)")
            status = next((x for x in block if "operación" in ascii_text(x) and len(x)<80),"")
            if not op:
                continue
            if not country_in_scope(source,country):
                continue
            date_for_scope = updated or approval
            if source.get("published_since") and date_for_scope and not date_in_scope(source,date_for_scope):
                continue
            key = ascii_key(op)
            found[key] = {"title":title,"url":url,"connector":"caf_catalog","discovery_key":f"{source['id']}|operation|{key}","metadata":{k:v for k,v in {"operation_number":op,"country":country,"approval_date":approval,"updated_date":updated,"risk_type":risk,"instrument":instrument,"sector":sector,"status":status}.items() if v}}
    items = list(found.values())[:int(source.get("max_candidates_per_run",60))]
    return items, {"records_scanned":records_scanned,"structured":True,"pages_checked":pages_checked,"eligible_records":len(items),"field_model":"CAF catalogue cards"}


def section_values(lines, label, stop_labels):
    start = None
    for i,line in enumerate(lines):
        if ascii_text(label) in ascii_text(line):
            start = i; break
    if start is None: return []
    values=[]
    for line in lines[start+1:]:
        low=ascii_text(line)
        if any(ascii_text(s) in low for s in stop_labels): break
        if line and len(line)<120: values.append(line)
    return values


def bancoldex_page_url(base,page):
    if page == 0: return base
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}page={page}"


def discover_bancoldex(source):
    found={}
    pages_checked=0
    records_scanned=0
    stop=["Tamaño de Empresa","Destino de los Recursos","Sector","Cobertura Geográfica","Ver detalle","Cupo disponible"]
    for page in range(int(source.get("max_pages",5))):
        parser=parse_page(bancoldex_page_url(source["url"],page))
        pages_checked += 1
        records_scanned += len(parser.links)
        for href,text in parser.links:
            url=absolute_candidate(source,href)
            if not url: continue
            title=title_from_link(url,text)
            idx=find_line(parser.lines,title)
            block=nearby(parser.lines,idx,2,80)
            joined=" | ".join(block)
            date = first_regex(joined,r"(\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s*/?\s*20\d{2}|\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s+de\s+20\d{2})")
            if source.get("published_since") and date and not date_in_scope(source,date.replace("/"," ")):
                continue
            cupo = first_regex(joined,r"Cupo disponible\*?\s*\|?\s*([^|]+)")
            sizes = section_values(block,"Tamaño de Empresa",stop)
            uses = section_values(block,"Destino de los Recursos",stop)
            sectors = section_values(block,"Sector",stop)
            geography = section_values(block,"Cobertura Geográfica",stop)
            key=canonical(url)
            found[key]={"title":title,"url":url,"connector":"bancoldex_catalog","discovery_key":f"{source['id']}|url|{key}","metadata":{k:v for k,v in {"publication_date":date,"available_facility":cupo,"company_size":sizes[:6],"use_of_proceeds":uses[:8],"sector":sectors[:6],"geographic_scope":geography[:40]}.items() if v}}
    items=list(found.values())[:int(source.get("max_candidates_per_run",80))]
    return items,{"records_scanned":records_scanned,"structured":True,"pages_checked":pages_checked,"eligible_records":len(items),"field_model":"Bancóldex credit-line cards"}


def run_connector(source):
    connector=source.get("connector","html_catalog")
    funcs={"idbinvest_xml":discover_idbinvest_xml,"caf_catalog":discover_caf,"bancoldex_catalog":discover_bancoldex,"html_catalog":discover_html}
    if connector not in funcs: raise RuntimeError(f"Unsupported connector: {connector}")
    try:
        return funcs[connector](source), False
    except Exception:
        if source.get("fallback_connector") == "html_catalog" and connector != "html_catalog":
            return discover_html(source), True
        raise


def main():
    registry=load_json(REGISTRY,{"sources":[]})
    previous=load_json(QUEUE,{"candidates":[]})
    projects=load_json(PROJECTS,{"projects":[]})
    known_urls={canonical(p.get("source_url","")) for p in projects.get("projects",[]) if p.get("source_url")}
    known_titles={ascii_key(p.get("name","")) for p in projects.get("projects",[]) if p.get("name")}
    previous_by_key={}
    for c in previous.get("candidates",[]):
        key=c.get("discovery_key") or f"legacy|url|{canonical(c.get('url',''))}"
        previous_by_key[key]=c
    run_at=now_iso(); discovered={}; source_runs=[]; new_items=[]
    for source in registry.get("sources",[]):
        connector=source.get("connector","html_catalog")
        if not source.get("enabled"):
            source_runs.append({"source_id":source["id"],"enabled":False,"connector":connector,"status":"registered_not_active","checked_at":None,"candidate_count":0})
            continue
        run={"source_id":source["id"],"enabled":True,"connector":connector,"status":"ok","checked_at":run_at,"candidate_count":0}
        try:
            (items,stats),fallback=run_connector(source)
            run.update(stats); run["fallback_used"]=fallback
            accepted=0
            for item in items:
                url=item.get("url",""); title=clean_text(item.get("title","")); key=item.get("discovery_key") or f"{source['id']}|url|{canonical(url)}"
                if not title or canonical(url) in known_urls or ascii_key(title) in known_titles: continue
                old=previous_by_key.get(key)
                candidate={"id":old.get("id") if old else hashlib.sha1(key.encode()).hexdigest()[:14],"discovery_key":key,"source_id":source["id"],"source_name":source["organization"],"candidate_kind":source.get("candidate_kind","unknown"),"connector":item.get("connector",connector),"title":title,"url":url,"metadata":item.get("metadata",{}),"first_seen":old.get("first_seen") if old else run_at,"last_seen":run_at,"currently_listed":True,"review_status":old.get("review_status","pending_review") if old else "pending_review","review_notes":old.get("review_notes","") if old else ""}
                discovered[key]=candidate
                if old is None: new_items.append(candidate)
                accepted += 1
            run["candidate_count"]=accepted
        except Exception as exc:
            run["status"]="error"; run["error"]=clean_text(str(exc))[:500]
        source_runs.append(run)
    for key,old in previous_by_key.items():
        if key not in discovered:
            retained=dict(old); retained["currently_listed"]=False; discovered[key]=retained
    candidates=sorted(discovered.values(),key=lambda c:(c.get("review_status")!="pending_review",c.get("first_seen") or "",c.get("title") or ""))
    save_json(QUEUE,{"schema_version":"1.2","updated_at":run_at,"status":"active","policy":"Candidates are discovery signals only and require human review before publication.","source_runs":source_runs,"candidates":candidates})
    lines=["# Project discovery review queue","",f"Run: {run_at}","","New candidates were detected from registered official-source connectors. Review each primary source before adding or changing any Project Intelligence record.",""]
    for c in new_items[:40]:
        meta=c.get("metadata",{}); detail=" · ".join(str(meta.get(k)) for k in ("project_number","operation_number","country","publication_date","approval_date","sector","available_facility") if meta.get(k))
        lines += [f"- **{c['title']}** — {c['source_name']}"+(f" — {detail}" if detail else "")+"  ",f"  {c['url']}"]
    if not new_items: lines.append("No new candidates in this run.")
    if len(new_items)>40: lines += ["",f"{len(new_items)-40} additional candidates are in public/data/discovery-queue.json."]
    lines += ["","Do not auto-publish candidates. Confirm identity, geography, instrument, disclosed amount, source date and relevance first."]
    REVIEW_MD.write_text("\n".join(lines)+"\n",encoding="utf-8")
    out=os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out,"a",encoding="utf-8") as fh:
            fh.write(f"new_count={len(new_items)}\n")
            fh.write(f"checked_source_count={sum(1 for x in source_runs if x.get('enabled'))}\n")
            fh.write(f"failed_source_count={sum(1 for x in source_runs if x.get('status')=='error')}\n")
            fh.write(f"structured_source_count={sum(1 for x in source_runs if x.get('structured'))}\n")
    print(f"Discovery run complete: {len(new_items)} new candidates; {len(candidates)} retained candidates.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
