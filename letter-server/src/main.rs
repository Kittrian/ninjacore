use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use typst::layout::PagedDocument;
use typst_as_lib::TypstEngine;

#[derive(Deserialize)]
struct LetterRequest {
    recipient: String,
    sender: String,
    subject: String,
    body: String,
    logo_base64: Option<String>,
    signature_base64: Option<String>,
    use_ai_improve: bool,
}

async fn ai_improve_text(text: String) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let api_key = std::env::var("GROQ_API_KEY").expect("GROQ_API_KEY must be set");

    let response = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "llama-3.3-70b-versatile",
            "messages": [{
                "role": "system",
                "content": "You are a professional business writer. Improve the following letter to be more polished, formal, and persuasive while keeping the original meaning."
            }, {
                "role": "user",
                "content": text
            }],
            "temperature": 0.7,
            "max_tokens": 1500
        }))
        .send()
        .await?;

    let data: serde_json::Value = response.json().await?;
    Ok(data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or(&text)
        .to_string())
}

fn generate_typst_source(
    req: &LetterRequest,
    improved_body: &str,
    assets: &mut Vec<(&'static str, Vec<u8>)>,
) -> String {
    let mut typst = String::from(
        r#"#set page(
  paper: "us-letter",
  margin: (x: 1in, y: 1in),
  header: align(right, text(size: 10pt, "Confidential"))
)

#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: true)

"#,
    );

    if let Some(logo_b64) = &req.logo_base64 {
        if let Ok(bytes) = STANDARD.decode(logo_b64) {
            assets.push(("logo.png", bytes));
            typst.push_str("#align(center, image(\"logo.png\", width: 30%))\n\n");
        }
    }

    let first_name = req
        .recipient
        .split_whitespace()
        .next()
        .unwrap_or("Sir/Madam");

    typst.push_str(&format!(
        r#"#align(right, text(datetime.today().display("[month repr:long] [day], [year]")))

#v(2em)

To: {recipient}

Subject: {subject}

Dear {first_name},

{improved_body}

Best regards,

{sender}
"#,
        recipient = req.recipient,
        subject = req.subject,
        first_name = first_name,
        sender = req.sender,
        improved_body = improved_body
    ));

    if let Some(sig_b64) = &req.signature_base64 {
        if let Ok(bytes) = STANDARD.decode(sig_b64) {
            assets.push(("signature.png", bytes));
            typst.push_str("\n#image(\"signature.png\", width: 25%)\n");
        }
    }

    typst
}

fn compile_pdf(typst_source: String, assets: Vec<(&'static str, Vec<u8>)>) -> Result<Vec<u8>, String> {
    let mut engine_builder = TypstEngine::builder()
        .main_file(typst_source)
        .fonts(typst_assets::fonts());

    if !assets.is_empty() {
        engine_builder = engine_builder.with_static_file_resolver(assets);
    }

    let engine = engine_builder.build();

    let compiled = engine.compile::<PagedDocument>();
    for w in &compiled.warnings {
        log::warn!("Typst warning: {w:?}");
    }

    let doc = compiled
        .output
        .map_err(|e| format!("Compile error: {e:?}"))?;

    typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default())
        .map_err(|e| format!("PDF export failed: {e:?}"))
}

#[post("/generate-letter")]
async fn generate_letter(req: web::Json<LetterRequest>) -> impl Responder {
    let start = std::time::Instant::now();

    let improved_text: Option<String> = if req.use_ai_improve {
        match ai_improve_text(req.body.clone()).await {
            Ok(improved) => Some(improved),
            Err(e) => {
                log::warn!("AI failed, using original: {}", e);
                None
            }
        }
    } else {
        None
    };

    let final_body = improved_text.clone().unwrap_or_else(|| req.body.clone());

    let mut assets: Vec<(&'static str, Vec<u8>)> = Vec::new();
    let typst_source = generate_typst_source(&req, &final_body, &mut assets);

    let pdf_bytes = match compile_pdf(typst_source, assets) {
        Ok(b) => b,
        Err(e) => return HttpResponse::InternalServerError().body(e),
    };

    log::info!("Letter generated in {:?}", start.elapsed());

    HttpResponse::Ok()
        .content_type("application/pdf")
        .append_header((
            "Content-Disposition",
            "attachment; filename=\"professional_letter.pdf\"",
        ))
        .body(pdf_bytes)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    log::info!("Letter Server starting on http://0.0.0.0:8080");

    HttpServer::new(|| App::new().service(generate_letter))
        .workers(8)
        .bind(("0.0.0.0", 8080))?
        .run()
        .await
}
