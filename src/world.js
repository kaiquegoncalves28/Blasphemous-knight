// Mapa de blocos e colisão de retângulos contra o mapa.
(function (BK) {
  "use strict";

  const T = BK.TILE;
  const TILE_CODES = new Set(["#", "X", "?", "!", "=", "^", "~", "L"]);
  const SOLID = new Set(["#", "X", "?", "!"]);
  const STANDABLE = new Set(["#", "X", "?", "!", "="]);

  class World {
    constructor(def) {
      const rows = def.map;
      this.h = rows.length;
      this.w = Math.max(...rows.map((row) => row.length));
      this.tiles = [];
      this.spawns = []; // personagens/objetos encontrados no mapa
      for (let ty = 0; ty < this.h; ty += 1) {
        const row = [];
        for (let tx = 0; tx < this.w; tx += 1) {
          const code = rows[ty][tx] || ".";
          if (TILE_CODES.has(code)) {
            row.push(code);
          } else {
            row.push(".");
            if (code !== ".") {
              this.spawns.push({ code, tx, ty });
            }
          }
        }
        this.tiles.push(row);
      }
      this.pixelW = this.w * T;
      this.pixelH = this.h * T;
      this.bumps = new Map(); // "tx,ty" -> tempo restante da animação de batida
    }

    tileAt(tx, ty) {
      if (ty < 0 || ty >= this.h || tx < 0 || tx >= this.w) {
        return ".";
      }
      return this.tiles[ty][tx];
    }

    setTile(tx, ty, code) {
      if (ty >= 0 && ty < this.h && tx >= 0 && tx < this.w) {
        this.tiles[ty][tx] = code;
      }
    }

    // As laterais do mapa funcionam como paredes.
    solidAt(tx, ty) {
      if (tx < 0 || tx >= this.w) {
        return true;
      }
      return SOLID.has(this.tileAt(tx, ty));
    }

    standableAtPixel(x, y) {
      return STANDABLE.has(this.tileAt(Math.floor(x / T), Math.floor(y / T)));
    }

    solidAtPixel(x, y) {
      return this.solidAt(Math.floor(x / T), Math.floor(y / T));
    }

    // Lista [tx, ty, código] dos blocos (com os códigos pedidos) que o retângulo toca.
    tilesInRect(rect, codes) {
      const found = [];
      const x1 = Math.floor(rect.x / T);
      const x2 = Math.floor((rect.x + rect.w - 0.001) / T);
      const y1 = Math.floor(rect.y / T);
      const y2 = Math.floor((rect.y + rect.h - 0.001) / T);
      for (let ty = y1; ty <= y2; ty += 1) {
        for (let tx = x1; tx <= x2; tx += 1) {
          const code = this.tileAt(tx, ty);
          if (codes.includes(code)) {
            found.push([tx, ty, code]);
          }
        }
      }
      return found;
    }

    // Move um corpo (x, y, w, h, vx, vy) resolvendo colisões: primeiro no eixo X,
    // depois no Y. Plataformas "=" só seguram quem vem de cima.
    moveBody(body, dt, level) {
      const result = { hitWall: false, ceiling: [] };

      body.x += body.vx * dt;
      const top = Math.floor(body.y / T);
      const bottom = Math.floor((body.y + body.h - 0.001) / T);
      if (body.vx > 0) {
        const tx = Math.floor((body.x + body.w - 0.001) / T);
        for (let ty = top; ty <= bottom; ty += 1) {
          if (this.solidAt(tx, ty)) {
            body.x = tx * T - body.w;
            body.vx = 0;
            result.hitWall = true;
            break;
          }
        }
      } else if (body.vx < 0) {
        const tx = Math.floor(body.x / T);
        for (let ty = top; ty <= bottom; ty += 1) {
          if (this.solidAt(tx, ty)) {
            body.x = (tx + 1) * T;
            body.vx = 0;
            result.hitWall = true;
            break;
          }
        }
      }

      const previousBottom = body.y + body.h;
      body.y += body.vy * dt;
      body.onGround = false;
      body.platform = null;
      const left = Math.floor(body.x / T);
      const right = Math.floor((body.x + body.w - 0.001) / T);
      const dropping = body.dropTimer > 0;

      if (body.vy >= 0) {
        const ty = Math.floor((body.y + body.h) / T);
        for (let tx = left; tx <= right; tx += 1) {
          const code = this.tileAt(tx, ty);
          const oneWay = code === "=" && !body.ignoreOneWay && !dropping && previousBottom <= ty * T + 0.5;
          if (SOLID.has(code) || oneWay) {
            body.y = ty * T - body.h;
            body.vy = 0;
            body.onGround = true;
            break;
          }
        }
        if (!body.onGround && level && body.ridesPlatforms && !dropping) {
          for (const platform of level.platforms) {
            const overlapsX = body.x + body.w > platform.x && body.x < platform.x + platform.w;
            if (overlapsX && previousBottom <= platform.y + 0.5 && body.y + body.h >= platform.y) {
              body.y = platform.y - body.h;
              body.vy = 0;
              body.onGround = true;
              body.platform = platform;
              break;
            }
          }
        }
      } else {
        const ty = Math.floor(body.y / T);
        for (let tx = left; tx <= right; tx += 1) {
          if (SOLID.has(this.tileAt(tx, ty))) {
            result.ceiling.push([tx, ty]);
          }
        }
        if (result.ceiling.length) {
          body.y = (ty + 1) * T;
          body.vy = 0;
        }
      }
      return result;
    }
  }

  BK.World = World;
})(window.BK);
