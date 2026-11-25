{lib,stdenvNoCC,glib,gjs}:
stdenvNoCC.mkDerivation {
  pname="gnome-shell-extension-zenos-aod";version="0.1.6";
  src=lib.cleanSource ./.;nativeBuildInputs=[glib];dontBuild=true;
  doCheck=true;nativeCheckInputs=[gjs];
  checkPhase="gjs -m tests/model.js";
  installPhase=''
    destination="$out/share/gnome-shell/extensions/aod@neg-zero.com"
    mkdir -p "$destination/schemas"
    cp *.js metadata.json "$destination/"
    cp schemas/*.xml "$destination/schemas/"
    glib-compile-schemas --strict "$destination/schemas"
  '';
  passthru.extensionUuid="aod@neg-zero.com";
  meta={description="Live window-outline always on display for GNOME";license=lib.licenses.gpl3Plus;platforms=lib.platforms.linux;};
}
