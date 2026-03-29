// ── CORTEX i18n ───────────────────────────────────────────────────────────────
// Source de vérité unique pour toutes les chaînes UI.
// Ajouter une clé ici, l'utiliser via useT() dans les composants.

export type Locale = 'en' | 'fr';

export const LOCALES: Locale[] = ['en', 'fr'];

// ─────────────────────────────────────────────────────────────────────────────

const translations = {

  // ── Status labels ──────────────────────────────────────────────────────────
  'status.critical':   { en: 'Critical',   fr: 'Critique'    },
  'status.stressed':   { en: 'Stressed',   fr: 'Sous stress' },
  'status.healthy':    { en: 'Healthy',    fr: 'Sain'        },
  'status.observing':  { en: 'Observing',  fr: 'Observation' },

  // ── Topbar ─────────────────────────────────────────────────────────────────
  'topbar.scan':     { en: 'Run scan',       fr: 'Lancer un scan'      },
  'topbar.export':   { en: 'Export Report', fr: 'Exporter le rapport' },
  'topbar.exported': { en: 'Exported ✓',    fr: 'Exporté ✓'           },

  // ── Tabs (center) ──────────────────────────────────────────────────────────
  'tab.overview': { en: 'Overview', fr: "Vue d'ensemble" },
  'tab.graph':    { en: 'Graph',    fr: 'Graphe'         },
  'tab.history':  { en: 'Activity', fr: 'Activité'       },

  // ── Sidebar ────────────────────────────────────────────────────────────────
  'sidebar.search':    { en: 'Search modules…',     fr: 'Rechercher…'                    },
  'sidebar.modules':   { en: 'modules',             fr: 'modules'                        },
  'sidebar.noMatch':   { en: 'No match.',           fr: 'Aucun résultat.'                },
  'sidebar.awaiting':  { en: 'Awaiting first scan…', fr: 'En attente du premier scan…'  },
  'sidebar.hideEmpty': { en: 'hide empty',          fr: 'masquer vides'                  },
  'sidebar.showEmpty': { en: '+{n} empty',          fr: '+{n} vides'                     },
  'sidebar.clear':     { en: 'clear',               fr: 'effacer'                        },
  'sidebar.activity':  { en: 'Activity',            fr: 'Activité'                       },
  'sidebar.noEvents':  { en: 'No events yet.',      fr: 'Aucun événement.'               },

  // ── Filter chips ───────────────────────────────────────────────────────────
  'filter.all':      { en: 'All',      fr: 'Tout'         },
  'filter.critical': { en: 'Critical', fr: 'Critique'     },
  'filter.stressed': { en: 'Stressed', fr: 'Stressé'      },
  'filter.healthy':  { en: 'Healthy',  fr: 'Sain'         },
  'filter.hotspots': { en: 'Hotspots', fr: 'Points chauds'},

  // ── Overview ───────────────────────────────────────────────────────────────
  'overview.risk':        { en: 'risk',          fr: 'risque'             },
  'overview.riskScore':   { en: 'risk score',    fr: 'score de risque'    },
  'overview.health':      { en: 'health',        fr: 'santé'              },
  'overview.modules':     { en: 'Modules',       fr: 'Modules'            },
  'overview.topRisks':    { en: 'Top risks',     fr: 'Risques principaux' },
  'overview.hotspots':    { en: 'Hotspots',      fr: 'Points chauds'      },
  'overview.hotspotDesc': { en: 'Files with both high complexity and high churn.', fr: 'Fichiers à forte complexité et fort taux de modification.' },
  'overview.hubs':        { en: 'Critical hubs', fr: 'Hubs critiques'     },
  'overview.hubDesc':     { en: 'Widely imported files — bugs propagate across the project.', fr: 'Fichiers très importés — les bugs se propagent dans tout le projet.' },
  'overview.improving':   { en: 'Improving',     fr: 'En amélioration'    },
  'overview.awaiting':    { en: 'Awaiting first scan…', fr: 'En attente du premier scan…' },
  'overview.dependents':  { en: 'dependents',    fr: 'dépendants'         },

  // ── Overview stat cards ────────────────────────────────────────────────────
  'card.modules':  { en: 'Modules',  fr: 'Modules'  },
  'card.critical': { en: 'Critical', fr: 'Critique'  },
  'card.stressed': { en: 'Stressed', fr: 'Stressé'   },
  'card.healthy':  { en: 'Healthy',  fr: 'Sain'      },

  // ── Overview summaries ─────────────────────────────────────────────────────
  'summary.noModules':      { en: 'No modules analyzed yet.', fr: "Aucun module analysé pour l'instant." },
  'summary.allHealthy':     { en: 'All {n} modules are healthy. The codebase is in good shape — no immediate action required.', fr: 'Les {n} modules sont sains. Le projet est en bonne forme — aucune action requise.' },
  'summary.criticalSingle': { en: '1 critical module needs attention — most urgent: {file} ({metric}).', fr: '1 module critique nécessite une attention — le plus urgent : {file} ({metric}).' },
  'summary.criticalMulti':  { en: '{n} critical modules need attention — most urgent: {file} ({metric}).', fr: '{n} modules critiques nécessitent une attention — le plus urgent : {file} ({metric}).' },
  'summary.stressedWorse':  { en: '{n} stressed {files} getting worse.', fr: '{n} {files} stressé(s) se dégrade(nt).' },
  'summary.stressedStable': { en: '{n} {files} under stress but stable.', fr: '{n} {files} sous stress mais stable(s).' },
  'summary.file':           { en: 'file',   fr: 'fichier'  },
  'summary.files':          { en: 'files',  fr: 'fichiers' },
  'summary.healthDegraded': { en: 'Overall project health is degraded.', fr: 'La santé globale du projet est dégradée.' },
  'summary.healthModerate': { en: 'Project health is moderate.',         fr: 'La santé du projet est modérée.'         },

  // ── Metric labels (overview cards) ────────────────────────────────────────
  'metric.highChurn':      { en: 'High churn',      fr: 'Fort taux de modifs'  },
  'metric.highComplexity': { en: 'High complexity', fr: 'Forte complexité'     },
  'metric.hardToRead':     { en: 'Hard to read',    fr: 'Difficile à lire'     },
  'metric.largeFunctions': { en: 'Large functions', fr: 'Fonctions longues'    },
  'metric.deepNesting':    { en: 'Deep nesting',    fr: 'Imbrication profonde' },
  'metric.widelyImported': { en: 'Widely imported', fr: 'Très importé'         },

  // ── Metric explains (overview cards) ──────────────────────────────────────
  'explain.highChurn':      { en: 'This file changes very frequently — high risk of regressions.', fr: 'Ce fichier change très souvent — risque élevé de régressions.' },
  'explain.highComplexity': { en: 'Too many branching paths — hard to test and debug.',             fr: "Trop de chemins d'exécution — difficile à tester et déboguer."  },
  'explain.hardToRead':     { en: 'Heavy nesting and logic — high cognitive load for reviewers.',   fr: 'Imbrication et logique complexes — charge cognitive élevée.'     },
  'explain.largeFunctions': { en: 'Functions are too long — likely doing too many things at once.', fr: 'Fonctions trop longues — probablement trop de responsabilités.'  },
  'explain.deepNesting':    { en: 'Too many nested blocks — consider extracting sub-functions.',    fr: 'Trop de blocs imbriqués — extraire des sous-fonctions.'           },
  'explain.widelyImported': { en: 'Many files rely on this — changes here ripple across the project.', fr: 'Beaucoup de fichiers en dépendent — les changements se propagent.' },

  // ── History ────────────────────────────────────────────────────────────────
  'history.title':       { en: 'Project activity',  fr: 'Activité du projet'     },
  'history.scans':       { en: 'scans',             fr: 'scans'                  },
  'history.sinceFirst':  { en: 'since first scan',  fr: 'depuis le premier scan' },
  'history.recentScans': { en: 'Recent scans',      fr: 'Scans récents'          },
  'history.notEnough':   { en: 'Not enough activity yet.',                        fr: "Pas encore assez d'activité."     },
  'history.recorded':    { en: 'Cortex records the project score at each scan.', fr: 'Cortex enregistre le score du projet à chaque scan.' },
  'history.current':     { en: 'Current',           fr: 'Actuel'                 },
  'history.average':     { en: 'Average',           fr: 'Moyen'                  },
  'history.best':        { en: 'Best',              fr: 'Meilleur'               },
  'history.worst':       { en: 'Worst',             fr: 'Pire'                   },
  'history.newCritical': { en: 'Became critical',   fr: 'Devenus critiques'      },
  'history.degrading':   { en: 'Degrading',         fr: 'Se dégrade'             },
  'history.improving':   { en: 'Improving',         fr: 'En amélioration'        },
  'history.byScan':      { en: 'By scan',           fr: 'Par scan'               },
  'history.byDay':       { en: 'By day',            fr: 'Par jour'               },
  'history.points':      { en: 'points',                      fr: 'points'                          },
  'history.days':        { en: 'days',                        fr: 'jours'                           },
  'history.all':              { en: 'All',                                        fr: 'Tout'                                          },
  'history.dragToPan':        { en: 'drag to explore',                             fr: 'glisser pour explorer'                         },
  'history.loading':          { en: 'Loading…',                                    fr: 'Chargement…'                                   },
  'history.firstScan':        { en: 'First scan — no comparison available.',        fr: 'Premier scan — pas de comparaison disponible.' },
  'history.noChange':         { en: 'No significant changes detected.',             fr: 'Aucun changement significatif détecté.'        },
  'history.degradedAt':       { en: '↑ Degraded',                                  fr: '↑ Dégradé'                                     },
  'history.improvedAt':       { en: '↓ Improved',                                  fr: '↓ Amélioré'                                    },
  'history.backToToday':      { en: '← Today',                                     fr: '← Aujourd\'hui'                                },
  'history.latestChanges':    { en: 'Latest changes',                               fr: 'Derniers changements'                          },

  // ── Graph / Flow ───────────────────────────────────────────────────────────
  'graph.hint':       { en: 'scroll to zoom · drag to pan', fr: 'scroll pour zoomer · glisser pour déplacer' },
  'graph.imports':    { en: 'imports',                      fr: 'importe'                                    },
  'graph.importedBy': { en: 'imported by',                  fr: 'importé par'                                },
  'graph.fit':        { en: 'FIT',                          fr: 'AJUSTER'                           },
  'graph.tension':    { en: 'tension',                      fr: 'tension'                           },
  'graph.modeLayers': { en: 'LAYERS',                       fr: 'LAYERS'                            },
  'graph.modeAll':    { en: 'ALL LINKS',                    fr: 'TOUS LES LIENS'                    },

  // ── Detail panel ───────────────────────────────────────────────────────────
  'detail.tabs.metrics':   { en: 'METRICS',   fr: 'MÉTRIQUES'  },
  'detail.tabs.functions': { en: 'FUNCTIONS', fr: 'FONCTIONS'  },
  'detail.tension':        { en: 'tension',   fr: 'tension'    },
  'detail.history':        { en: 'HISTORY',   fr: 'HISTORIQUE' },
  'detail.breakdown':      { en: 'BREAKDOWN', fr: 'DÉTAIL'     },
  'detail.coupling':       { en: 'COUPLING',  fr: 'COUPLAGE'   },
  'detail.hotspot':        { en: 'HOTSPOT',   fr: 'POINT CHAUD'},
  'detail.hotspotDesc':    { en: 'Composite of complexity × churn. High = unstable and complex zone.', fr: 'Combinaison de complexité et de modifications fréquentes. Élevé = zone instable.' },
  'detail.language':       { en: 'LANGUAGE',  fr: 'LANGAGE'    },
  'detail.noFunctions':    { en: 'No named functions found.', fr: 'Aucune fonction nommée trouvée.' },
  'detail.fanIn':          { en: 'fan-in',    fr: 'fan-in'     },
  'detail.fanOut':         { en: 'fan-out',   fr: 'fan-out'    },
  'detail.lines':          { en: 'lines',     fr: 'lignes'     },
  'detail.noHistory':      { en: 'No history yet.',          fr: 'Aucun historique.'         },
  'detail.noCoupling':     { en: 'No coupling detected.',    fr: 'Aucun couplage détecté.'   },
  'detail.coChanges':      { en: 'co-changes',               fr: 'co-modifications'          },
  'detail.commit':         { en: 'commit',                   fr: 'commit'                    },
  'detail.commits':        { en: 'commits',                  fr: 'commits'                   },
  'detail.usedBy':         { en: 'Used by',                  fr: 'Utilisé par'               },
  'detail.uses':           { en: 'Uses',                     fr: 'Utilise'                   },
  'detail.notImported':    { en: 'Not imported anywhere',    fr: 'Non importé'               },
  'detail.dependOn':       { en: '{n} file{s} depend on this', fr: '{n} fichier{s} dépend{ent} de ce fichier' },
  'detail.noDeps':         { en: 'No dependencies',          fr: 'Aucune dépendance'         },
  'detail.dependency':     { en: '{n} dependenc{y}',         fr: '{n} dépendance{s}'         },
  'detail.widelyImported': { en: '⚠ Widely imported — changes here may affect {n} other files', fr: '⚠ Très importé — toute modification peut affecter {n} autres fichiers' },

  // ── MetricBar labels ───────────────────────────────────────────────────────
  'metric.label.cyclomatic': { en: 'CYCLOMATIC COMPLEXITY', fr: 'COMPLEXITÉ CYCLOMATIQUE' },
  'metric.label.cognitive':  { en: 'COGNITIVE COMPLEXITY',  fr: 'COMPLEXITÉ COGNITIVE'   },
  'metric.label.funcSize':   { en: 'FUNCTION SIZE',         fr: 'TAILLE DES FONCTIONS'   },
  'metric.label.churn':      { en: 'CHURN',                 fr: 'MODIFICATIONS'          },
  'metric.label.depth':      { en: 'NESTING DEPTH',         fr: 'IMBRICATION'            },
  'metric.label.params':     { en: 'PARAMETERS',            fr: 'PARAMÈTRES'             },

  // ── MetricBar descriptions ─────────────────────────────────────────────────
  'metric.desc.cyclomatic': { en: 'Number of independent paths through the code — a score ≥ 10 means every change risks breaking an untested path.',       fr: 'Nombre de chemins indépendants dans le code — un score ≥ 10 signifie que chaque modification risque de casser un chemin non testé.' },
  'metric.desc.cognitive':  { en: 'How hard the code is to read — penalizes deep nesting and non-linear flow more than cyclomatic.',                         fr: "Difficulté de lecture du code — pénalise davantage l'imbrication profonde et les flux non linéaires."                              },
  'metric.desc.funcSize':   { en: 'Lines in the largest function — over 50 lines usually means a function is doing too many things.',                        fr: 'Lignes dans la plus grande fonction — au-delà de 50 lignes, une fonction fait probablement trop de choses.'                     },
  'metric.desc.churn':      { en: 'Commits touching this file in the last 30 days — high churn signals instability or poor design.',                         fr: 'Commits sur ce fichier dans les 30 derniers jours — un fort taux signale une instabilité ou une conception fragile.'           },
  'metric.desc.depth':      { en: 'Deepest level of nested blocks — each level adds cognitive overhead for the reader.',                                     fr: "Niveau maximal d'imbrication — chaque niveau augmente la charge cognitive du lecteur."                                          },
  'metric.desc.params':     { en: 'Max parameters in any function — more than 4–5 signals missing abstraction.',                                             fr: 'Nombre maximal de paramètres — plus de 4-5 indique une abstraction manquante.'                                               },

  // ── MetricBar explains ─────────────────────────────────────────────────────
  'metric.expl.cyclomatic.critical': { en: 'Max complexity of {n} — split this function into smaller pieces.',    fr: 'Complexité max de {n} — découper cette fonction en parties plus petites.'     },
  'metric.expl.cyclomatic.warn':     { en: 'Complexity of {n} — add tests before touching this file.',            fr: 'Complexité de {n} — ajouter des tests avant de toucher ce fichier.'           },
  'metric.expl.cognitive.critical':  { en: 'Score of {n} — reviewers will struggle. Flatten and extract.',        fr: 'Score de {n} — difficile à relire. Aplatir les conditions et extraire.'      },
  'metric.expl.cognitive.warn':      { en: 'Score of {n} — noticeable cognitive load. A light refactor would help.', fr: 'Score de {n} — charge cognitive notable. Un léger refactoring aiderait.' },
  'metric.expl.funcSize.critical':   { en: '{n} lines — this function does too much. Apply single-responsibility.', fr: '{n} lignes — cette fonction fait trop de choses. Principe de responsabilité unique.' },
  'metric.expl.funcSize.warn':       { en: '{n} lines — consider extracting some logic.',                          fr: "{n} lignes — envisager d'extraire une partie de la logique."                  },
  'metric.expl.churn.critical':      { en: '{n} commits/30d — hotspot. Frequent changes indicate design debt.',    fr: '{n} commits/30j — point chaud. Les modifications fréquentes indiquent une dette de conception.' },
  'metric.expl.churn.warn':          { en: '{n} commits/30d — above average. Worth investigating.',                fr: "{n} commits/30j — au-dessus de la moyenne. Vaut la peine d'investiguer."    },
  'metric.expl.depth.critical':      { en: 'Depth of {n} — use early returns or extract sub-functions.',          fr: "Profondeur de {n} — utiliser des retours anticipés ou extraire des sous-fonctions." },
  'metric.expl.depth.warn':          { en: 'Depth of {n} — consider flattening with guard clauses.',              fr: "Profondeur de {n} — envisager d'aplatir avec des clauses de garde."          },
  'metric.expl.params.critical':     { en: '{n} params — group related params into an object or config struct.',   fr: '{n} paramètres — regrouper les paramètres liés dans un objet ou une struct.' },
  'metric.expl.params.warn':         { en: '{n} params — borderline. Consider grouping some.',                     fr: "{n} paramètres — limite. Envisager d'en regrouper certains."                 },

  // ── Function detail panel ─────────────────────────────────────────────────
  'fn.back':           { en: '← Functions',  fr: '← Fonctions'    },
  'fn.line':           { en: 'line',          fr: 'ligne'           },
  'fn.lines':          { en: 'lines',         fr: 'lignes'          },
  'fn.topSignal':      { en: 'top signal',    fr: 'signal le plus élevé' },
  'fn.seeInCode':      { en: 'View in code',  fr: 'Voir dans le code' },
  'fn.detail':         { en: 'DETAIL',        fr: 'DÉTAIL'          },
  'fn.label.cyclomatic': { en: 'Cyclomatic complexity', fr: 'Complexité cyclomatique' },
  'fn.label.cognitive':  { en: 'Cognitive complexity',  fr: 'Complexité cognitive'   },
  'fn.label.size':       { en: 'Size',                  fr: 'Taille'                 },
  'fn.label.params':     { en: 'Parameters',             fr: 'Paramètres'             },
  'fn.label.depth':      { en: 'Nesting depth',          fr: "Profondeur d'imbrication" },
  'fn.cx.critical':    { en: 'High complexity — hard to test and maintain.',       fr: 'Complexité élevée — difficile à tester et à maintenir.' },
  'fn.cx.warn':        { en: 'Moderate complexity — keep an eye on it.',           fr: 'Complexité modérée — à surveiller.'                     },
  'fn.cx.ok':          { en: 'Low complexity — good sign.',                        fr: 'Complexité faible — bon signe.'                         },
  'fn.cog.critical':   { en: 'Very hard to read. Consider splitting this function.', fr: 'Très difficile à lire. Envisager de découper cette fonction.' },
  'fn.cog.warn':       { en: 'Readability hurt by nesting or conditions.',         fr: "Lisibilité dégradée par l'imbrication ou les conditions." },
  'fn.cog.ok':         { en: 'Easy to read.',                                      fr: 'Facile à lire.'                                         },
  'fn.size.critical':  { en: 'Function too long — refactoring candidate.',         fr: 'Fonction trop longue — candidat au refactoring.'        },
  'fn.size.warn':      { en: 'Acceptable size but could be trimmed.',              fr: 'Taille acceptable mais peut être réduite.'              },
  'fn.size.ok':        { en: 'Reasonable size.',                                   fr: 'Taille raisonnable.'                                    },
  'fn.params.critical':{ en: 'Too many parameters — signature hard to use.',       fr: 'Trop de paramètres — signature difficile à utiliser.'   },
  'fn.params.warn':    { en: 'High parameter count.',                              fr: 'Nombre de paramètres élevé.'                            },
  'fn.params.ok':      { en: 'Good parameter count.',                              fr: 'Nombre de paramètres correct.'                          },
  'fn.depth.critical': { en: 'Deep nesting — hard to follow.',                    fr: 'Imbrication profonde — difficile à suivre.'             },
  'fn.depth.warn':     { en: 'Moderate nesting.',                                 fr: 'Imbrication modérée.'                                   },
  'fn.depth.ok':       { en: 'Reasonable nesting.',                               fr: 'Imbrication raisonnable.'                               },

  // ── Code view ──────────────────────────────────────────────────────────────
  'code.back':         { en: '← Back',                   fr: '← Retour'                       },
  'code.loading':      { en: 'Loading…',                 fr: 'Chargement…'                    },
  'code.error':        { en: 'Cannot read file.',        fr: 'Impossible de lire le fichier.' },
  'code.line':         { en: 'line',                     fr: 'ligne'                          },
  'code.lines':        { en: 'lines',                    fr: 'lignes'                         },
  'code.edit':         { en: 'Edit',                     fr: 'Modifier'                       },
  'code.save':         { en: 'Save',                     fr: 'Sauvegarder'                    },
  'code.saving':       { en: 'saving…',                  fr: 'sauvegarde…'                    },
  'code.cancel':       { en: 'Cancel',                   fr: 'Annuler'                        },
  'code.writeFailed':  { en: 'write failed',             fr: 'échec écriture'                 },

  // ── Welcome screen ─────────────────────────────────────────────────────────
  'welcome.title':      { en: 'Welcome to Cortex',              fr: 'Bienvenue sur Cortex'            },
  'welcome.yourProjects': { en: 'Your projects',                fr: 'Vos projets'                     },
  'welcome.subtitle':   { en: 'A local-first code quality monitor.\nAdd a project to get started.', fr: 'Un analyseur de qualité de code local.\nAjoutez un projet pour commencer.' },
  'welcome.selectProject': { en: 'Select a project to start monitoring', fr: 'Sélectionnez un projet à surveiller' },
  'welcome.addFirst':   { en: 'Add your first project',         fr: 'Ajouter votre premier projet'    },
  'welcome.addAnother': { en: 'Add another project',            fr: 'Ajouter un autre projet'         },
  'welcome.noScan':     { en: 'no scan yet',                   fr: 'pas encore de scan'              },
  'welcome.justNow':    { en: 'just now',                      fr: 'à l\'instant'                    },
  'welcome.daysAgo':    { en: '{n}d ago',                      fr: 'il y a {n}j'                     },
  'welcome.hoursAgo':   { en: '{n}h ago',                      fr: 'il y a {n}h'                     },
  'welcome.minutesAgo': { en: '{n}m ago',                      fr: 'il y a {n}min'                   },

  // ── ProjectSwitcher ────────────────────────────────────────────────────────
  'switcher.addProject': { en: 'Add new project…', fr: 'Ajouter un projet…' },
  'switcher.active':     { en: 'active',            fr: 'actif'              },
  'switcher.noScan':     { en: 'no scan',           fr: 'pas de scan'        },

  // ── Settings ───────────────────────────────────────────────────────────────
  'settings.title':              { en: 'Settings',            fr: 'Paramètres'          },
  'settings.subtitle':           { en: 'Exclusions',           fr: 'Exclusions'            },
  'settings.language':           { en: 'Language',             fr: 'Langue'                },
  'settings.exclusions':         { en: 'Scan exclusions',                  fr: 'Exclusions du scan'                  },
  'settings.dirsDesc':           { en: 'Ignored folders — not scanned, not counted in the score.', fr: 'Dossiers ignorés — ni scannés, ni comptabilisés dans le score.' },
  'settings.addDir':             { en: 'Add a folder…',                    fr: 'Ajouter un dossier…'                },
  'settings.saved':              { en: '✓ Saved',                          fr: '✓ Sauvegardé'                        },
  'settings.ignoredFiles':       { en: 'Manually ignored files',                       fr: 'Fichiers ignorés manuellement'               },
  'settings.ignoredFilesHint':   { en: 'hover a file in the sidebar → Ø',              fr: 'survole un fichier dans la sidebar → Ø'      },
  'settings.noIgnoredFiles':     { en: 'None',                                          fr: 'Aucun'                                       },
  'settings.excludedFiles':      { en: 'Excluded from scoring',                         fr: 'Exclus du scoring'                           },
  'settings.excludedFilesHint':  { en: 'click Ø next to a file in the sidebar',        fr: 'cliquer Ø à côté d\'un fichier dans la sidebar' },
  'settings.noExcludedFiles':    { en: 'None',                                          fr: 'Aucun'                                       },
  'settings.restore':            { en: 'Restore',                          fr: 'Rétablir'                            },
  'settings.files':              { en: '{n} file{s}',                      fr: '{n} fichier{s}'                      },
  'security.title':           { en: 'Security',                         fr: 'Sécurité'                                         },
  'security.subtitle':        { en: 'Static pattern analysis · Dependency audit (requires network)', fr: 'Analyse de patterns · Audit des dépendances (réseau requis)' },
  'security.scanning':        { en: 'Scanning…',                        fr: 'Analyse…'                                          },
  'security.rescan':          { en: 'Re-scan',                          fr: 'Relancer'                                          },
  'security.runScan':         { en: 'Run scan',                         fr: 'Lancer l\'analyse'                                 },
  'security.noScanYet':       { en: 'No scan run yet.',                 fr: 'Aucune analyse lancée.'                            },
  'security.noScanDesc':      { en: 'Pattern analysis is fully local and instant. Dependency audit queries the npm advisory database and requires network access.', fr: 'L\'analyse de patterns est locale et instantanée. L\'audit des dépendances interroge la base npm et nécessite une connexion réseau.' },
  'security.scanningFiles':   { en: 'Scanning files…',                  fr: 'Analyse en cours…'                                 },
  'security.noPatterns':      { en: '✓ No patterns detected',           fr: '✓ Aucun pattern détecté'                           },
  'security.noPatternsMsg':   { en: '✓ No patterns detected.',          fr: '✓ Aucun pattern détecté.'                          },
  'security.noDepVulns':      { en: '✓ No dependency vulnerabilities either.', fr: '✓ Aucune vulnérabilité dans les dépendances non plus.' },
  'security.noVulns':         { en: '✓ No known vulnerabilities in dependencies.', fr: '✓ Aucune vulnérabilité connue dans les dépendances.' },
  'security.vulnFound1':      { en: 'vulnerability found in dependencies',  fr: 'vulnérabilité trouvée dans les dépendances'    },
  'security.vulnFoundN':      { en: 'vulnerabilities found in dependencies', fr: 'vulnérabilités trouvées dans les dépendances' },
  'security.tabPatterns':     { en: 'PATTERNS',                         fr: 'PATTERNS'                                          },
  'security.tabDeps':         { en: 'DEPENDENCIES',                     fr: 'DÉPENDANCES'                                       },
  'security.filterAll':       { en: 'All',                              fr: 'Tout'                                              },
  'security.auditNotAvail':   { en: 'Dependency audit not available.',   fr: 'Audit des dépendances indisponible.'               },
  'security.auditNoProject':  { en: 'No compatible Node.js project found.', fr: 'Aucun projet Node.js compatible trouvé.'       },
  'security.auditFailed':     { en: 'Audit failed.',                    fr: 'Audit échoué.'                                     },
  'security.npmSource':       { en: 'Source: npm advisory database ·',  fr: 'Source : base npm ·'                               },
  'security.viewInCode':      { en: 'View in code',                     fr: 'Voir dans le code'                                 },
  'security.fixAvailable':    { en: 'FIX AVAILABLE',                    fr: 'CORRECTIF DISPO'                                   },
  'security.runAuditFix':     { en: 'Run: npm audit fix',               fr: 'Exécuter : npm audit fix'                          },

  'settings.appearance':          { en: 'Appearance',                        fr: 'Apparence'                            },
  'settings.transparency':        { en: 'Blur effects',                      fr: 'Effets de flou'                       },
  'settings.transparencyDesc':    { en: 'Enable transparency and blur. May cause issues on Windows or Linux.', fr: 'Active la transparence et le flou. Peut causer des problèmes sur Windows ou Linux.' },
  'settings.security':            { en: 'Security',                          fr: 'Sécurité'                             },
  'settings.autoScanLabel':       { en: 'Automatic scan on first visit',     fr: 'Scan automatique à la première visite'},
  'settings.autoScanDesc':        { en: 'Runs pattern analysis + dependency audit when opening the Security tab.', fr: 'Lance l\'analyse de patterns + l\'audit des dépendances à l\'ouverture de l\'onglet Sécurité.' },
  'settings.autoScanNetwork':     { en: 'Dependency audit requires a network connection.', fr: 'L\'audit des dépendances nécessite une connexion réseau.' },

} satisfies Record<string, { en: string; fr: string }>;

// ─────────────────────────────────────────────────────────────────────────────

export type TranslationKey = keyof typeof translations;

/** Traduit une clé avec des variables optionnelles ({n}, {file}, etc.). */
export function translate(key: TranslationKey, locale: Locale, vars?: Record<string, string | number>): string {
  const entry = translations[key];
  let str = entry[locale] ?? entry['en'];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
