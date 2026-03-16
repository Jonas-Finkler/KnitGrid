{
  description = "Browser-based knitting pattern viewer and editor";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f {
        pkgs = nixpkgs.legacyPackages.${system};
        inherit system;
      });
    in {
      packages = forAllSystems ({ pkgs, system }: {
        default = pkgs.stdenv.mkDerivation {
          pname = "knitgrid";
          version = "1.0.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          installPhase = ''
            mkdir -p $out/share/knitgrid $out/bin

            cp index.html styles.css app.js $out/share/knitgrid/

            makeWrapper ${pkgs.python3}/bin/python $out/bin/knitgrid \
              --add-flags "-m http.server 8080 -d $out/share/knitgrid"
          '';

          meta = {
            description = "Browser-based knitting pattern viewer and editor";
            homepage = "https://github.com/Jonas-Finkler/KnitGrid";
            license = pkgs.lib.licenses.gpl3Only;
            mainProgram = "knitgrid";
          };
        };
      });

      devShells = forAllSystems ({ pkgs, ... }: {
        default = pkgs.mkShell {
          packages = [ pkgs.python3 ];
        };
      });

      apps = forAllSystems ({ pkgs, system }: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/knitgrid";
        };
        serve-dev = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve-dev" ''
            ${pkgs.python3}/bin/python -m http.server 8080
          '');
        };
      });
    };
}
