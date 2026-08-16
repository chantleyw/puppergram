// Puppergram desktop shell.
//
// The desktop build is a thin window around the same web app that ships as a
// PWA — there is no desktop-only logic, and the litter data still lives in the
// webview's IndexedDB on this device.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // Lets the Solana Explorer link open in the user's real browser
        // instead of dead-ending inside the app window.
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Puppergram");
}
