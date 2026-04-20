// ── CORTEX i18n ───────────────────────────────────────────────────────────────
// Source de vérité unique pour toutes les chaînes UI.
// Ajouter une clé ici, l'utiliser via useT() dans les composants.

export type Locale = 'en' | 'fr';

export const LOCALES: Locale[] = ['en', 'fr'];

// ─────────────────────────────────────────────────────────────────────────────

const translations = {

  // ── Status labels ──────────────────────────────────────────────────────────
  'status.critical':   { en: 'High pressure', fr: 'Pression élevée' },
  'status.stressed':   { en: 'Elevated',      fr: 'Élevé'            },
  'status.healthy':    { en: 'Low pressure',  fr: 'Faible pression'  },
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
  'filter.critical': { en: 'High pressure', fr: 'Pression élevée' },
  'filter.stressed': { en: 'Elevated',      fr: 'Élevé'            },
  'filter.healthy':  { en: 'Low pressure',  fr: 'Faible pression'  },
  'filter.hotspots': { en: 'Hotspots', fr: 'Points chauds'},

  // ── Overview ───────────────────────────────────────────────────────────────
  'overview.risk':        { en: 'pressure',                 fr: 'pression'                   },
  'overview.riskScore':   { en: 'maintenance pressure',     fr: 'pression de maintenance'    },
  'overview.health':      { en: 'maintenance pressure',     fr: 'pression de maintenance'    },
  'overview.modules':     { en: 'Modules',       fr: 'Modules'            },
  'overview.topRisks':    { en: 'Priority files', fr: 'Fichiers prioritaires' },
  'overview.hotspots':    { en: 'Hotspots',      fr: 'Points chauds'      },
  'overview.hotspotDesc': { en: 'Files where structural load and recent change activity are both high.', fr: 'Fichiers où la charge structurelle et l’activité de changement récente sont toutes deux élevées.' },
  'overview.hubs':        { en: 'High fan-in files', fr: 'Fichiers à fan-in élevé' },
  'overview.hubDesc':     { en: 'Files with high dependency centrality — changes here may affect many other files.', fr: 'Fichiers à forte centralité de dépendance — les changements ici peuvent affecter de nombreux autres fichiers.' },
  'overview.improving':   { en: 'Lower pressure',     fr: 'Pression en baisse'    },
  'overview.awaiting':    { en: 'Awaiting first scan…', fr: 'En attente du premier scan…' },
  'overview.dependents':  { en: 'dependents',    fr: 'dépendants'         },

  // ── Overview stat cards ────────────────────────────────────────────────────
  'card.modules':  { en: 'Modules',  fr: 'Modules'  },
  'card.critical': { en: 'High pressure', fr: 'Pression élevée' },
  'card.stressed': { en: 'Elevated',      fr: 'Élevé'            },
  'card.healthy':  { en: 'Low pressure',  fr: 'Faible pression'  },

  // ── Overview summaries ─────────────────────────────────────────────────────
  'summary.noModules':      { en: 'No modules analyzed yet.', fr: "Aucun module analysé pour l'instant." },
  'summary.allHealthy':     { en: 'All {n} modules are in a low-pressure range.', fr: 'Les {n} modules sont dans une plage de faible pression.' },
  'summary.criticalSingle': { en: '1 high-pressure module stands out — highest signal: {file} ({metric}).', fr: '1 module à forte pression ressort — signal principal : {file} ({metric}).' },
  'summary.criticalMulti':  { en: '{n} high-pressure modules stand out — highest signal: {file} ({metric}).', fr: '{n} modules à forte pression ressortent — signal principal : {file} ({metric}).' },
  'summary.stressedWorse':  { en: '{n} elevated {files} show higher maintenance pressure.', fr: '{n} {files} élevés montrent une pression de maintenance plus forte.' },
  'summary.stressedStable': { en: '{n} {files} remain in the elevated range.', fr: '{n} {files} restent dans la plage élevée.' },
  'summary.file':           { en: 'file',   fr: 'fichier'  },
  'summary.files':          { en: 'files',  fr: 'fichiers' },
  'summary.healthDegraded': { en: 'Overall maintenance pressure is high.', fr: 'La pression de maintenance globale est élevée.' },
  'summary.healthModerate': { en: 'Overall maintenance pressure is moderate.', fr: 'La pression de maintenance globale est modérée.' },

  // ── Metric labels (overview cards) ────────────────────────────────────────
  'metric.highChurn':      { en: 'Recent change activity', fr: 'Activité de changement récente' },
  'metric.highComplexity': { en: 'Structural load',        fr: 'Charge structurelle'            },
  'metric.hardToRead':     { en: 'Structural load',        fr: 'Charge structurelle'            },
  'metric.largeFunctions': { en: 'Large functions', fr: 'Fonctions longues'    },
  'metric.deepNesting':    { en: 'Structural load',        fr: 'Charge structurelle'            },
  'metric.widelyImported': { en: 'Dependency centrality',  fr: 'Centralité de dépendance'       },

  // ── Metric explains (overview cards) ──────────────────────────────────────
  'explain.highChurn':      { en: 'Recent change activity is a major part of this file\'s score.', fr: 'L’activité de changement récente est une composante majeure du score de ce fichier.' },
  'explain.highComplexity': { en: 'Structural load is being driven by branching complexity.',       fr: 'La charge structurelle est tirée par la complexité des branches.' },
  'explain.hardToRead':     { en: 'Structural load is being driven by nesting and control flow.',   fr: 'La charge structurelle est tirée par l’imbrication et le flux de contrôle.' },
  'explain.largeFunctions': { en: 'Large functions are a major part of this file\'s score.',        fr: 'Les grandes fonctions sont une composante majeure du score de ce fichier.' },
  'explain.deepNesting':    { en: 'Structural load is being driven by deep nesting.',               fr: 'La charge structurelle est tirée par une imbrication profonde.' },
  'explain.widelyImported': { en: 'Dependency centrality is high — changes here may affect many other files.', fr: 'La centralité de dépendance est élevée — les changements ici peuvent affecter de nombreux autres fichiers.' },

  // ── History ────────────────────────────────────────────────────────────────
  'history.title':       { en: 'Project activity',  fr: 'Activité du projet'     },
  'history.scans':       { en: 'scans',             fr: 'scans'                  },
  'history.sinceFirst':  { en: 'since first scan',  fr: 'depuis le premier scan' },
  'history.recentScans': { en: 'Recent scans',      fr: 'Scans récents'          },
  'history.notEnough':   { en: 'Not enough activity yet.',                        fr: "Pas encore assez d'activité."     },
  'history.recorded':    { en: 'Cortex records the project score at each scan.', fr: 'Cortex enregistre le score du projet à chaque scan.' },
  'history.current':     { en: 'Current',           fr: 'Actuel'                 },
  'history.average':     { en: 'Average',           fr: 'Moyen'                  },
  'history.best':        { en: 'Lowest',            fr: 'Plus bas'               },
  'history.worst':       { en: 'Highest',           fr: 'Plus haut'              },
  'history.newCritical': { en: 'Entered high-pressure range', fr: 'Entrés en forte pression' },
  'history.degrading':   { en: 'Higher pressure',   fr: 'Pression en hausse'     },
  'history.improving':   { en: 'Lower pressure',    fr: 'Pression en baisse'     },
  'history.byScan':      { en: 'By scan',           fr: 'Par scan'               },
  'history.byDay':       { en: 'By day',            fr: 'Par jour'               },
  'history.points':      { en: 'points',                      fr: 'points'                          },
  'history.days':        { en: 'days',                        fr: 'jours'                           },
  'history.all':              { en: 'All',                                        fr: 'Tout'                                          },
  'history.dragToPan':        { en: 'drag to explore',                             fr: 'glisser pour explorer'                         },
  'history.loading':          { en: 'Loading…',                                    fr: 'Chargement…'                                   },
  'history.firstScan':        { en: 'First scan — no comparison available.',        fr: 'Premier scan — pas de comparaison disponible.' },
  'history.noChange':         { en: 'No significant changes detected.',             fr: 'Aucun changement significatif détecté.'        },
  'history.degradedAt':       { en: '↑ Higher pressure',                           fr: '↑ Pression en hausse'                          },
  'history.improvedAt':       { en: '↓ Lower pressure',                            fr: '↓ Pression en baisse'                          },
  'history.backToToday':      { en: '← Today',                                     fr: '← Aujourd\'hui'                                },
  'history.latestChanges':    { en: 'Latest changes',                               fr: 'Derniers changements'                          },

  // ── Graph / Flow ───────────────────────────────────────────────────────────
  'graph.hint':       { en: 'scroll to zoom · drag to pan', fr: 'scroll pour zoomer · glisser pour déplacer' },
  'graph.imports':    { en: 'imports',                      fr: 'importe'                                    },
  'graph.importedBy': { en: 'imported by',                  fr: 'importé par'                                },
  'graph.fit':        { en: 'FIT',                          fr: 'AJUSTER'                           },
  'graph.tension':    { en: 'maintenance pressure',         fr: 'pression de maintenance'          },
  'graph.modeLayers': { en: 'LAYERS',                       fr: 'LAYERS'                            },
  'graph.modeAll':    { en: 'ALL LINKS',                    fr: 'TOUS LES LIENS'                    },

  // ── Detail panel ───────────────────────────────────────────────────────────
  'detail.tabs.metrics':   { en: 'METRICS',   fr: 'MÉTRIQUES'  },
  'detail.tabs.functions': { en: 'FUNCTIONS', fr: 'FONCTIONS'  },
  'detail.tension':        { en: 'maintenance pressure',   fr: 'pression de maintenance'    },
  'detail.history':        { en: 'HISTORY',   fr: 'HISTORIQUE' },
  'detail.breakdown':      { en: 'BREAKDOWN', fr: 'DÉTAIL'     },
  'detail.coupling':       { en: 'COUPLING',  fr: 'COUPLAGE'   },
  'detail.hotspot':        { en: 'HOTSPOT',   fr: 'POINT CHAUD'},
  'detail.hotspotDesc':    { en: 'Combination of structural load and recent change activity. High values point to a file that stands out on both signals.', fr: 'Combinaison de charge structurelle et d’activité de changement récente. Des valeurs élevées indiquent un fichier qui ressort sur les deux signaux.' },
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
  'detail.widelyImported': { en: '⚠ High dependency centrality — changes here may affect {n} other files', fr: '⚠ Forte centralité de dépendance — les changements ici peuvent affecter {n} autres fichiers' },

  // ── MetricBar labels ───────────────────────────────────────────────────────
  'metric.label.cyclomatic': { en: 'CYCLOMATIC COMPLEXITY', fr: 'COMPLEXITÉ CYCLOMATIQUE' },
  'metric.label.cognitive':  { en: 'COGNITIVE COMPLEXITY',  fr: 'COMPLEXITÉ COGNITIVE'   },
  'metric.label.funcSize':   { en: 'FUNCTION SIZE',         fr: 'TAILLE DES FONCTIONS'   },
  'metric.label.churn':      { en: 'CHURN',                 fr: 'MODIFICATIONS'          },
  'metric.label.depth':      { en: 'NESTING DEPTH',         fr: 'IMBRICATION'            },
  'metric.label.params':     { en: 'PARAMETERS',            fr: 'PARAMÈTRES'             },

  // ── MetricBar descriptions ─────────────────────────────────────────────────
  'metric.desc.cyclomatic': { en: 'Number of independent paths through the code — higher values increase structural load.',       fr: 'Nombre de chemins indépendants dans le code — des valeurs plus élevées augmentent la charge structurelle.' },
  'metric.desc.cognitive':  { en: 'How hard the code is to read — penalizes deep nesting and non-linear flow more than cyclomatic.',                         fr: "Difficulté de lecture du code — pénalise davantage l'imbrication profonde et les flux non linéaires."                              },
  'metric.desc.funcSize':   { en: 'Lines in the largest function — larger routines increase structural load.',                        fr: 'Lignes dans la plus grande fonction — des routines plus grandes augmentent la charge structurelle.'                     },
  'metric.desc.churn':      { en: 'Commits touching this file in the last 30 days — high churn reflects repeated recent changes.',                         fr: 'Commits sur ce fichier dans les 30 derniers jours — un churn élevé reflète des changements récents répétés.'           },
  'metric.desc.depth':      { en: 'Deepest level of nested blocks — each level adds cognitive overhead for the reader.',                                     fr: "Niveau maximal d'imbrication — chaque niveau augmente la charge cognitive du lecteur."                                          },
  'metric.desc.params':     { en: 'Max parameters in any function — higher counts increase interface complexity and structural load.',                                             fr: 'Nombre maximal de paramètres — des valeurs plus élevées augmentent la complexité d’interface et la charge structurelle.'                                               },

  // ── MetricBar explains ─────────────────────────────────────────────────────
  'metric.expl.cyclomatic.critical': { en: 'Max complexity of {n} — structural load is a major part of this file\'s score.',    fr: 'Complexité max de {n} — la charge structurelle est une composante majeure du score de ce fichier.'     },
  'metric.expl.cyclomatic.warn':     { en: 'Complexity of {n} — structural load is a visible part of this file\'s score.',            fr: 'Complexité de {n} — la charge structurelle est une composante visible du score de ce fichier.'           },
  'metric.expl.cognitive.critical':  { en: 'Score of {n} — structural load is being driven by cognitive complexity.',        fr: 'Score de {n} — la charge structurelle est tirée par la complexité cognitive.'      },
  'metric.expl.cognitive.warn':      { en: 'Score of {n} — cognitive complexity is contributing to structural load.', fr: 'Score de {n} — la complexité cognitive contribue à la charge structurelle.' },
  'metric.expl.funcSize.critical':   { en: '{n} lines — large routines are a major part of this file\'s score.', fr: '{n} lignes — les grandes routines sont une composante majeure du score de ce fichier.' },
  'metric.expl.funcSize.warn':       { en: '{n} lines — routine size is contributing to maintenance pressure.',                          fr: '{n} lignes — la taille des routines contribue à la pression de maintenance.'                  },
  'metric.expl.churn.critical':      { en: '{n} commits/30d — recent change activity is a major part of this file\'s score.',    fr: '{n} commits/30j — l’activité de changement récente est une composante majeure du score de ce fichier.' },
  'metric.expl.churn.warn':          { en: '{n} commits/30d — recent change activity is above average.',                fr: '{n} commits/30j — l’activité de changement récente est au-dessus de la moyenne.'    },
  'metric.expl.depth.critical':      { en: 'Depth of {n} — deep nesting is a major part of this file\'s structural load.',          fr: 'Profondeur de {n} — une imbrication profonde est une composante majeure de la charge structurelle de ce fichier.' },
  'metric.expl.depth.warn':          { en: 'Depth of {n} — nesting is contributing to structural load.',              fr: 'Profondeur de {n} — l’imbrication contribue à la charge structurelle.'          },
  'metric.expl.params.critical':     { en: '{n} params — parameter count is increasing interface complexity.',   fr: '{n} paramètres — le nombre de paramètres augmente la complexité d’interface.' },
  'metric.expl.params.warn':         { en: '{n} params — parameter count is contributing to structural load.',                     fr: '{n} paramètres — le nombre de paramètres contribue à la charge structurelle.'                 },

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
  'fn.cx.critical':    { en: 'High complexity — strong contributor to structural load.',       fr: 'Complexité élevée — forte contribution à la charge structurelle.' },
  'fn.cx.warn':        { en: 'Moderate complexity — contributes to structural load.',           fr: 'Complexité modérée — contribue à la charge structurelle.'                     },
  'fn.cx.ok':          { en: 'Low complexity — lower structural load.',                        fr: 'Complexité faible — charge structurelle plus faible.'                         },
  'fn.cog.critical':   { en: 'Very hard to read — strong contributor to structural load.', fr: 'Très difficile à lire — forte contribution à la charge structurelle.' },
  'fn.cog.warn':       { en: 'Readability is being affected by nesting or control flow.',         fr: 'La lisibilité est affectée par l’imbrication ou le flux de contrôle.' },
  'fn.cog.ok':         { en: 'Readability impact is low.',                                      fr: 'L’impact sur la lisibilité est faible.'                                         },
  'fn.size.critical':  { en: 'Function is very long — major contributor to structural load.',         fr: 'Fonction très longue — contribution majeure à la charge structurelle.'        },
  'fn.size.warn':      { en: 'Function length contributes to structural load.',              fr: 'La longueur de la fonction contribue à la charge structurelle.'              },
  'fn.size.ok':        { en: 'Function length is not a major signal.',                                   fr: 'La longueur de la fonction n’est pas un signal majeur.'                                    },
  'fn.params.critical':{ en: 'High parameter count — increases interface complexity.',       fr: 'Nombre de paramètres élevé — augmente la complexité d’interface.'   },
  'fn.params.warn':    { en: 'High parameter count.',                              fr: 'Nombre de paramètres élevé.'                            },
  'fn.params.ok':      { en: 'Parameter count is not a major signal.',                              fr: 'Le nombre de paramètres n’est pas un signal majeur.'                          },
  'fn.depth.critical': { en: 'Deep nesting — strong contributor to structural load.',                    fr: 'Imbrication profonde — forte contribution à la charge structurelle.'             },
  'fn.depth.warn':     { en: 'Nesting contributes to structural load.',                                 fr: 'L’imbrication contribue à la charge structurelle.'                                   },
  'fn.depth.ok':       { en: 'Nesting is not a major signal.',                               fr: 'L’imbrication n’est pas un signal majeur.'                               },

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
