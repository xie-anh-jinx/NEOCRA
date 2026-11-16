use chrono::{Datelike, NaiveDate};
use sqlx::PgPool;

pub fn roman_month(month: u32) -> &'static str {
    match month {
        1 => "I",
        2 => "II",
        3 => "III",
        4 => "IV",
        5 => "V",
        6 => "VI",
        7 => "VII",
        8 => "VIII",
        9 => "IX",
        10 => "X",
        11 => "XI",
        12 => "XII",
        _ => "I",
    }
}

pub fn parse_next_prefix(max_prefix: Option<&str>) -> u32 {
    max_prefix
        .and_then(|s| s.trim().parse::<u32>().ok())
        .map(|n| n + 1)
        .unwrap_or(1)
}

pub fn format_po_number(seq: u32, inisial: &str, date: NaiveDate) -> String {
    format!(
        "{:03}/{}-PO/{}/{}",
        seq,
        inisial,
        roman_month(date.month()),
        date.year()
    )
}

pub fn format_so_number(seq: u32, inisial: &str, date: NaiveDate) -> String {
    format!(
        "{:03}/SO/{}/{}/{}",
        seq,
        inisial,
        roman_month(date.month()),
        date.year()
    )
}

pub fn format_pp_number(seq: u32, inisial: &str, date: NaiveDate) -> String {
    format!(
        "{:03}/{}/PP/{}/{}",
        seq,
        inisial,
        roman_month(date.month()),
        date.year()
    )
}

pub async fn next_po_number(pool: &PgPool, date: NaiveDate) -> Result<String, sqlx::Error> {
    let year = date.year();
    let max_str: Option<String> = sqlx::query_scalar(
        "SELECT MAX(SUBSTR(nomor_po, 1, 3)) FROM po WHERE EXTRACT(YEAR FROM tanggal) = $1 AND SUBSTR(nomor_po, 1, 3) ~ '^[0-9]+$'",
    )
    .bind(year)
    .fetch_one(pool)
    .await?;

    let seq = parse_next_prefix(max_str.as_deref());
    Ok(format_po_number(seq, "CRA", date))
}

pub async fn next_so_number(pool: &PgPool, date: NaiveDate) -> Result<String, sqlx::Error> {
    let month = date.month() as i32;
    let year = date.year();
    let max_str: Option<String> = sqlx::query_scalar(
        "SELECT MAX(SUBSTR(nomor, 1, 3)) FROM so WHERE EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2 AND SUBSTR(nomor, 1, 3) ~ '^[0-9]+$'",
    )
    .bind(month)
    .bind(year)
    .fetch_one(pool)
    .await?;

    let seq = parse_next_prefix(max_str.as_deref());
    Ok(format_so_number(seq, "CRA", date))
}

pub async fn next_pp_number(pool: &PgPool, date: NaiveDate) -> Result<String, sqlx::Error> {
    let year = date.year();
    let max_str: Option<String> = sqlx::query_scalar(
        "SELECT MAX(SUBSTR(no_pp, 1, 3)) FROM permintaan_pembelian WHERE EXTRACT(YEAR FROM tanggal) = $1 AND SUBSTR(no_pp, 1, 3) ~ '^[0-9]+$'",
    )
    .bind(year)
    .fetch_one(pool)
    .await?;

    let seq = parse_next_prefix(max_str.as_deref());
    Ok(format_pp_number(seq, "CRA", date))
}

#[derive(Debug, Clone, PartialEq)]
pub struct LineCalc {
    pub gross: f64,
    pub diskon_rp: f64,
    pub net: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HeaderTotals {
    pub total: f64,
    pub total_discount: f64,
    pub dpp: f64,
    pub total_ppn: f64,
    pub total_pph: f64,
    pub grandtotal: f64,
}

pub fn compute_line(qty: f64, harga: f64, diskon_persen: f64, diskon_rp_override: Option<f64>) -> LineCalc {
    let gross = (qty * harga * 100.0).round() / 100.0;
    let diskon_rp = if diskon_persen > 0.0 {
        (gross * (diskon_persen / 100.0) * 100.0).round() / 100.0
    } else {
        diskon_rp_override.unwrap_or(0.0)
    };
    let net = ((gross - diskon_rp) * 100.0).round() / 100.0;
    LineCalc { gross, diskon_rp, net }
}

pub fn compute_totals(lines: &[LineCalc], is_ppn: bool, is_pph: bool) -> HeaderTotals {
    let total: f64 = (lines.iter().map(|l| l.gross).sum::<f64>() * 100.0).round() / 100.0;
    let total_discount: f64 = (lines.iter().map(|l| l.diskon_rp).sum::<f64>() * 100.0).round() / 100.0;
    let dpp = ((total - total_discount) * 100.0).round() / 100.0;
    let total_ppn = if is_ppn {
        (dpp * 0.11 * 100.0).round() / 100.0
    } else {
        0.0
    };
    let total_pph = if is_pph {
        (dpp * 0.02 * 100.0).round() / 100.0
    } else {
        0.0
    };
    let grandtotal = ((dpp + total_ppn + total_pph) * 100.0).round() / 100.0;

    HeaderTotals {
        total,
        total_discount,
        dpp,
        total_ppn,
        total_pph,
        grandtotal,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roman_month() {
        assert_eq!(roman_month(1), "I");
        assert_eq!(roman_month(6), "VI");
        assert_eq!(roman_month(12), "XII");
    }

    #[test]
    fn test_document_numbering() {
        let d = NaiveDate::from_ymd_opt(2026, 6, 24).unwrap();
        let next = parse_next_prefix(Some("204"));
        assert_eq!(next, 205);
        assert_eq!(format_po_number(next, "CRA", d), "205/CRA-PO/VI/2026");
        assert_eq!(format_so_number(next, "CRA", d), "205/SO/CRA/VI/2026");
        assert_eq!(format_pp_number(72, "CRA", d), "072/CRA/PP/VI/2026");
    }

    #[test]
    fn test_totals_calculation() {
        let l1 = compute_line(10.0, 100_000.0, 10.0, None);
        assert_eq!(l1.gross, 1_000_000.0);
        assert_eq!(l1.diskon_rp, 100_000.0);
        assert_eq!(l1.net, 900_000.0);

        let totals = compute_totals(&[l1], true, false);
        assert_eq!(totals.total, 1_000_000.0);
        assert_eq!(totals.total_discount, 100_000.0);
        assert_eq!(totals.dpp, 900_000.0);
        assert_eq!(totals.total_ppn, 99_000.0);
        assert_eq!(totals.grandtotal, 999_000.0);
    }
}
