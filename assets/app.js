/* CompSci site: no build step. Pages are static.
   Nav is real relative links (GitHub Pages safe).
   The course works with JavaScript off. */
document.documentElement.dataset.ok = "1";

(function () {
  var path = location.pathname || "";
  var prefix = /\/(lessons|courses)\//.test(path) ? "../assets/" : "assets/";
  if (document.querySelector("script[src$=\"config.js\"]")) return;
  var cfg = document.createElement("script");
  cfg.src = prefix + "config.js";
  cfg.onload = function () {
    var work = document.createElement("script");
    work.type = "module";
    work.src = prefix + "work.js";
    document.body.appendChild(work);
  };
  document.body.appendChild(cfg);
})();
