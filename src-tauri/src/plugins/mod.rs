use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub category: String, // hardware | integration | ai | utility
    pub version: String,
    pub enabled: bool,
    pub description: String,
}

pub fn default_plugins(enabled_ids: &[String]) -> Vec<PluginManifest> {
    let catalog = vec![
        ("core-erp", "NEOCRA Core ERP", "utility", "1.0.0", "Modul inti sinkronisasi & transaksi offline"),
        ("barcode-scanner", "Barcode & QR Scanner", "hardware", "1.0.0", "Dukungan HID/USB/Serial scanner gudang"),
        ("thermal-printer", "Thermal Printer (ESC/POS)", "hardware", "1.0.0", "Cetak struk & surat jalan via USB/Bluetooth/LAN"),
        ("rfid-nfc", "RFID & NFC Reader", "hardware", "1.0.0", "Pembacaan kartu pegawai & tag aset (PC/SC)"),
        ("whatsapp-gateway", "WhatsApp Notification", "integration", "1.0.0", "Kirim notifikasi approval & invoice via WAHA"),
        ("ai-assistant", "AI Assistant & MCP", "ai", "1.0.0", "Asisten analitik Ollama / OpenAI / DeepSeek / Claude"),
    ];

    catalog
        .into_iter()
        .map(|(id, name, category, version, description)| PluginManifest {
            id: id.to_string(),
            name: name.to_string(),
            category: category.to_string(),
            version: version.to_string(),
            enabled: enabled_ids.iter().any(|e| e == id),
            description: description.to_string(),
        })
        .collect()
}
