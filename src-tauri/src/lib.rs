use std::thread;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

// Custom command to start a temporary localhost loopback server for Google OAuth
#[tauri::command]
fn start_oauth_listener(app: tauri::AppHandle) -> Result<String, String> {
    // Attempt binding to port 14251 first, fallback to an ephemeral port (port 0)
    let server = tiny_http::Server::http("127.0.0.1:14251")
        .or_else(|_| tiny_http::Server::http("127.0.0.1:0"))
        .map_err(|e| format!("Failed to bind loopback HTTP server: {}", e))?;

    let port = server
        .server_addr()
        .to_ip()
        .map(|addr| addr.port())
        .ok_or_else(|| "Failed to retrieve local server port".to_string())?;

    let callback_url = format!("http://127.0.0.1:{}/callback", port);
    let app_handle = app.clone();

    // Spawn server handling in a background thread
    thread::spawn(move || {
        let start_time = Instant::now();
        let timeout_duration = Duration::from_secs(300); // 5-minute timeout

        while start_time.elapsed() < timeout_duration {
            match server.recv_timeout(Duration::from_millis(500)) {
                Ok(Some(request)) => {
                    let url = request.url().to_string();

                    // Handle CORS preflight OPTIONS request
                    if *request.method() == tiny_http::Method::Options {
                        let response = tiny_http::Response::empty(204)
                            .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
                            .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"POST, GET, OPTIONS"[..]).unwrap())
                            .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap());
                        let _ = request.respond(response);
                        continue;
                    }

                    if url.starts_with("/callback") {
                        // Return an HTML page that reads the hash fragment and POSTs it back to /token
                        let html = r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SplitIt - Google Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      padding: 2.5rem;
      border-radius: 1rem;
      border: 1px solid #334155;
      text-align: center;
      max-width: 420px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h2 { color: #38bdf8; margin-top: 0; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
    .status { margin-top: 1.5rem; font-weight: 500; color: #4ade80; }
  </style>
</head>
<body>
  <div class="card">
    <h2>SplitIt Authentication</h2>
    <p>Processing authorization with SplitIt desktop application...</p>
    <div id="status" class="status">Connecting...</div>
  </div>
  <script>
    (function() {
      const hash = window.location.hash ? window.location.hash.substring(1) : '';
      const search = window.location.search ? window.location.search.substring(1) : '';
      const fullParams = hash || search;

      if (fullParams) {
        fetch('/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: fullParams })
        })
        .then(() => {
          document.getElementById('status').innerText = '✓ Success! You can close this tab and return to SplitIt.';
          setTimeout(() => {
            try { window.close(); } catch (e) {}
          }, 1500);
        })
        .catch(() => {
          document.getElementById('status').innerText = 'Completed. Please switch back to SplitIt.';
        });
      } else {
        document.getElementById('status').innerText = 'Ready. Please switch back to SplitIt.';
      }
    })();
  </script>
</body>
</html>"#;

                        let response = tiny_http::Response::from_string(html)
                            .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap());
                        let _ = request.respond(response);
                    } else if url.starts_with("/token") {
                        if *request.method() != tiny_http::Method::Post {
                            let response = tiny_http::Response::from_string("Method Not Allowed")
                                .with_status_code(405);
                            let _ = request.respond(response);
                            continue;
                        }

                        let mut content = String::new();
                        let mut reader = request.as_reader();
                        let _ = std::io::Read::read_to_string(&mut reader, &mut content);

                        // Parse json: {"hash": "..."}
                        let hash_val = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            json.get("hash").and_then(|v| v.as_str()).unwrap_or(&content).to_string()
                        } else {
                            content
                        };

                        // Emit event to Tauri frontend
                        let _ = app_handle.emit("splitit:oauth-token", hash_val);

                        // Restore, show, and focus main window
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.unminimize();
                            let _ = win.show();
                            let _ = win.set_focus();
                        }

                        let response = tiny_http::Response::from_string("{\"status\":\"ok\"}")
                            .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                            .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                        let _ = request.respond(response);

                        // Terminate listener loop after successfully receiving token
                        break;
                    } else {
                        let response = tiny_http::Response::from_string("Not Found")
                            .with_status_code(404);
                        let _ = request.respond(response);
                    }
                }
                Ok(None) => {
                    // Timeout elapsed on socket recv, continue checking total duration
                    continue;
                }
                Err(_) => {
                    // Socket error occurred, exit loop
                    break;
                }
            }
        }
    });

    Ok(callback_url)
}

// Custom command to safely write backup JSON to any path chosen in native dialog
#[tauri::command]
fn save_backup_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to save backup: {}", e))
}

// Custom command to safely read backup JSON from any path chosen in native dialog
#[tauri::command]
fn read_backup_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read backup: {}", e))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_oauth_listener,
            save_backup_file,
            read_backup_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
