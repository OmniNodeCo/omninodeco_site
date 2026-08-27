/* ============================================================
   OmniNodeCo — live GitHub projects
   ------------------------------------------------------------
   Renders the projects page (and home featured strip) straight
   from the GitHub REST API:

     • repo list      GET /users/{OWNER}/repos
     • latest release GET /repos/{OWNER}/{repo}/releases/latest

   Data is cached in localStorage for CACHE_TTL so repeated
   visits don't burn the unauthenticated API rate limit.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = {
    OWNER: "OmniNodeCo", // your GitHub user/org
    EXCLUDE: ["omninodeco_site", "OmniNodeCo"], // the site itself + org profile repo
    CACHE_KEY: "onp_github_projects_v1",
    CACHE_TTL: 10 * 60 * 1000, // 10 minutes
  };

  var featuredHost = document.querySelector("[data-featured-host]");
  var gridHost = document.querySelector("[data-project-grid]");
  var filtersHost = document.querySelector("[data-filters-host]");
  var featuredCount = parseInt(featuredHost && featuredHost.getAttribute("data-limit"), 10) || 1;
  var gridLimit = parseInt(gridHost && gridHost.getAttribute("data-limit"), 10) || 999;

  if (!featuredHost && !gridHost) return; // no GitHub sections on this page

  /* ---------- helpers ---------- */

  function humanSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var i = 0;
    var n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(n >= 100 || i === 0 ? 0 : 1) + " " + units[i];
  }

  function prettyTopic(t) {
    return t
      .split(/[-_]/)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join(" ");
  }

  function shortDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // Convert API zipball/tarball redirect URLs to direct codeload links
  function directDownload(url) {
    if (!url) return url;
    return url
      .replace("https://api.github.com/repos/", "https://codeload.github.com/")
      .replace("/zipball/", "/zip/refs/tags/")
      .replace("/tarball/", "/tar.gz/refs/tags/");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- cache ---------- */

  function loadCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY));
      if (c && Array.isArray(c.projects) && Date.now() - c.ts < CONFIG.CACHE_TTL) {
        return c.projects;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveCache(projects) {
    try {
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ ts: Date.now(), projects: projects }));
    } catch (e) { /* ignore */ }
  }

  /* ---------- GitHub API ---------- */

  function fetchJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function enrichWithRelease(repo) {
    return fetchJSON(
      "https://api.github.com/repos/" + CONFIG.OWNER + "/" + repo.name + "/releases/latest"
    )
      .then(function (rel) {
        return Object.assign({}, repo, {
          release: {
            tag: rel.tag_name,
            name: rel.name || rel.tag_name,
            published: rel.published_at,
            html_url: rel.html_url,
            zipball: rel.zipball_url,
            assets: (rel.assets || []).map(function (a) {
              return { name: a.name, size: a.size, url: a.browser_download_url };
            }),
          },
        });
      })
      .catch(function () {
        return Object.assign({}, repo, { release: null });
      });
  }

  function loadProjects() {
    var cached = loadCache();
    if (cached) return Promise.resolve(cached);

    return fetchJSON(
      "https://api.github.com/users/" + CONFIG.OWNER + "/repos?per_page=100&sort=updated"
    )
      .then(function (repos) {
        var wanted = repos.filter(function (r) {
          return !r.archived && CONFIG.EXCLUDE.indexOf(r.name) === -1;
        });
        return Promise.all(wanted.map(enrichWithRelease));
      })
      .then(function (list) {
        saveCache(list);
        return list;
      });
  }

  function sortProjects(list) {
    return list.slice().sort(function (a, b) {
      // releases first, then stars, then most recently pushed
      if (!!a.release !== !!b.release) return a.release ? -1 : 1;
      if ((b.stargazers_count || 0) !== (a.stargazers_count || 0)) {
        return (b.stargazers_count || 0) - (a.stargazers_count || 0);
      }
      return String(b.pushed_at).localeCompare(String(a.pushed_at));
    });
  }

  /* ---------- rendering ---------- */

  function thumbClass(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return "thumb-" + ((hash % 4) + 1);
  }

  function statusChip(repo) {
    if (repo.release) {
      return '<span class="status status-live">Latest ' + esc(repo.release.tag) + "</span>";
    }
    return '<span class="status status-beta">No release yet</span>';
  }

  function tags(repo) {
    var out = [];
    (repo.topics || []).slice(0, 5).forEach(function (t) {
      out.push('<span class="tag">' + esc(prettyTopic(t)) + "</span>");
    });
    if (repo.language) out.push('<span class="tag">' + esc(repo.language) + "</span>");
    return out.join("");
  }

  function downloadButtons(repo) {
    var html = '<div class="card-actions">';

    if (repo.release && repo.release.assets.length) {
      var first = repo.release.assets[0];
      html +=
        '<a class="btn btn-primary btn-sm" href="' + esc(first.url) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
        "Download " + esc(first.name) +
        "</a>";
      if (repo.release.assets.length > 1) {
        html +=
          '<a class="btn btn-ghost btn-sm" href="' + esc(repo.release.html_url) + '">' +
          repo.release.assets.length + " assets</a>";
      }
      html +=
        '<a class="btn btn-ghost btn-sm" href="' + esc(directDownload(repo.release.zipball)) + '">Source</a>';
    } else if (repo.release) {
      // release exists but no binary assets
      html +=
        '<a class="btn btn-primary btn-sm" href="' + esc(directDownload(repo.release.zipball)) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
        "Download " + esc(repo.release.tag) +
        "</a>";
      html +=
        '<a class="btn btn-ghost btn-sm" href="' + esc(repo.release.html_url) + '">Release notes</a>';
    } else {
      // no release: offer a source ZIP of the default branch
      var zip = "https://codeload.github.com/" + CONFIG.OWNER + "/" + repo.name +
        "/zip/refs/heads/" + (repo.default_branch || "main");
      html +=
        '<a class="btn btn-primary btn-sm" href="' + esc(zip) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
        "Download ZIP</a>";
      html +=
        '<a class="btn btn-ghost btn-sm" href="https://github.com/' + CONFIG.OWNER + "/" + repo.name + '/releases">Releases</a>';
    }

    html +=
      '<a class="btn btn-ghost btn-sm" href="' + esc(repo.html_url) + '">GitHub</a>';
    html += "</div>";
    return html;
  }

  function projectCard(repo) {
    var desc = repo.description || "No description provided — check the repo on GitHub.";
    return (
      '<article class="card project-card reveal" data-category="' + esc((repo.topics || []).join(" ")) + '">' +
      '<div class="project-thumb ' + thumbClass(repo.name) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.6 2.4 5.5 2.7 5.5 2.7a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.1c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>' +
      "</div>" +
      '<div class="project-meta">' +
      "<h3 style=\"margin:0;\">" + esc(repo.name) + "</h3>" +
      statusChip(repo) +
      "</div>" +
      "<p>" + esc(desc) + "</p>" +
      '<div class="project-stats">' +
      '<span title="Stars">★ ' + (repo.stargazers_count || 0) + "</span>" +
      '<span title="Last push">Updated ' + esc(shortDate(repo.pushed_at)) + "</span>" +
      (repo.release ? '<span title="Released">' + esc(shortDate(repo.release.published)) + "</span>" : "") +
      "</div>" +
      '<div class="tags">' + tags(repo) + "</div>" +
      downloadButtons(repo) +
      "</article>"
    );
  }

  function featuredBanner(repo) {
    var desc = repo.description || "No description provided — check the repo on GitHub.";
    var dl = "";
    var dlUrl = repo.release && repo.release.assets.length
      ? repo.release.assets[0].url
      : repo.release ? directDownload(repo.release.zipball)
      : "https://codeload.github.com/" + CONFIG.OWNER + "/" + repo.name + "/zip/refs/heads/" + (repo.default_branch || "main");
    dl =
      '<a class="btn btn-primary" href="' + esc(dlUrl) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      (repo.release ? "Download " + esc(repo.release.tag) : "Download ZIP") +
      "</a> " +
      '<a class="btn btn-ghost" href="' + esc(repo.html_url) + '">View on GitHub</a>';

    return (
      '<div class="featured reveal" id="featured">' +
      '<div class="featured-visual ' + thumbClass(repo.name) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.6 2.4 5.5 2.7 5.5 2.7a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.1c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>' +
      "</div>" +
      '<div class="featured-body">' +
      '<div class="project-meta" style="justify-content:flex-start; gap:12px;">' +
      '<span class="eyebrow">Featured project</span>' +
      statusChip(repo) +
      "</div>" +
      "<h3>" + esc(repo.name) + "</h3>" +
      "<p>" + esc(desc) + "</p>" +
      '<div class="featured-stats">' +
      "<div><b>★ " + (repo.stargazers_count || 0) + "</b><span>Stars</span></div>" +
      "<div><b>" + esc(repo.language || "—") + "</b><span>Language</span></div>" +
      "<div><b>" + esc(shortDate(repo.pushed_at) || "—") + "</b><span>Last push</span></div>" +
      "</div>" +
      '<div class="tags" style="margin-top:0;">' + tags(repo) + "</div>" +
      "<div style=\"margin-top:18px;\">" + dl + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function errorCard() {
    return (
      '<div class="card api-error reveal" style="grid-column:1/-1; text-align:center; padding:40px;">' +
      "<h3>Couldn't reach the GitHub API</h3>" +
      "<p>The live project list needs a moment — or GitHub rate-limited us. Try again in a minute.</p>" +
      '<p style="margin-top:14px;"><a class="btn btn-ghost btn-sm" href="https://github.com/' + CONFIG.OWNER + '">Open our GitHub →</a></p>' +
      "</div>"
    );
  }

  function skeletonCard() {
    return (
      '<div class="card skeleton reveal" style="min-height:280px;">' +
      '<div class="sk sk-thumb"></div>' +
      '<div class="sk sk-line w60"></div>' +
      '<div class="sk sk-line w90"></div>' +
      '<div class="sk sk-line w75"></div>' +
      "</div>"
    );
  }

  /* ---------- filters ---------- */

  function buildFilters(projects) {
    if (!filtersHost) return;
    var topics = [];
    projects.forEach(function (r) {
      (r.topics || []).forEach(function (t) {
        if (topics.indexOf(t) === -1) topics.push(t);
      });
    });
    topics.sort();

    var html = '<button class="filter-btn active" data-filter="all">All</button>';
    topics.forEach(function (t) {
      html += '<button class="filter-btn" data-filter="' + esc(t) + '">' + esc(prettyTopic(t)) + "</button>";
    });
    filtersHost.innerHTML = html;

    filtersHost.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      filtersHost.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var filter = btn.getAttribute("data-filter");
      document.querySelectorAll("[data-project-grid] .project-card").forEach(function (card) {
        var topicsList = (card.getAttribute("data-category") || "").split(" ");
        var show = filter === "all" || topicsList.indexOf(filter) !== -1;
        card.style.display = show ? "" : "none";
      });
    });
  }

  /* ---------- boot ---------- */

  function revealEls(els) {
    if (window.omninodecoReveal) {
      window.omninodecoReveal(els);
    } else {
      els.forEach(function (el) { el.classList.add("in-view"); });
    }
  }

  function render(projects) {
    var sorted = sortProjects(projects);

    if (featuredHost) {
      var top = sorted.slice(0, featuredCount);
      featuredHost.innerHTML = top.map(featuredBanner).join("");
      revealEls(Array.prototype.slice.call(featuredHost.querySelectorAll(".reveal")));
    }

    if (gridHost) {
      var cards = sorted.slice(0, gridLimit);
      gridHost.innerHTML = cards.map(projectCard).join("");
      revealEls(Array.prototype.slice.call(gridHost.querySelectorAll(".reveal")));
    }

    if (filtersHost) buildFilters(sorted.slice(0, gridLimit));
  }

  function showError() {
    if (gridHost) {
      gridHost.innerHTML = errorCard();
      revealEls(Array.prototype.slice.call(gridHost.querySelectorAll(".reveal")));
    }
    if (featuredHost) {
      featuredHost.innerHTML = "";
    }
  }

  // skeleton while loading
  if (featuredHost) featuredHost.innerHTML = skeletonCard();
  if (gridHost) {
    var n = gridLimit > 6 ? 6 : gridLimit;
    gridHost.innerHTML = "";
    for (var i = 0; i < n; i++) gridHost.innerHTML += skeletonCard();
  }

  loadProjects().then(render).catch(showError);
})();
