{
  description = "Knitting Pattern Tool";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      knit-pattern-tool = pkgs.stdenv.mkDerivation {
        pname = "knit-pattern-tool";
        version = "0.1.0";
        src = ./.;

        installPhase = ''
          mkdir -p $out/share/knit-pattern-tool
          cp index.html styles.css app.js $out/share/knit-pattern-tool/
        '';
      };
    in {
      packages.${system}.default = knit-pattern-tool;

      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.python3 ];
      };

      apps.${system} = {
        serve = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve" ''
            ${pkgs.python3}/bin/python -m http.server 8080 -d ${knit-pattern-tool}/share/knit-pattern-tool
          '');
        };
        serve-dev = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve-dev" ''
            ${pkgs.python3}/bin/python -m http.server 8080
          '');
        };
        open = {
          type = "app";
          program = toString (pkgs.writeShellScript "open" ''
            ${pkgs.xdg-utils}/bin/xdg-open http://localhost:8080
          '');
        };
      };
    };
}
