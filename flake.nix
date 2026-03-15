{
  description = "Knitting Pattern Tool";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.python3 ];
      };

      apps.${system} = {
        serve = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve" ''
            cd ${./.}
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
