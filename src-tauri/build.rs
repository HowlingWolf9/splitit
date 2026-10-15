fn main() {
    let attributes = tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "start_oauth_listener",
            "save_backup_file",
            "read_backup_file",
        ]),
    );

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
