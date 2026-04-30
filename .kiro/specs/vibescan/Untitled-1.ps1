
Exit codes:
- 0: successful run, no issues
- 1: some issues found, action required
- 2: run failure
- 3: successful run, no result
- 4: signing or verification failure
- 5: BOM validation error

Version: 2026.11.1

Usage:
   [flags]
   [command]

Available Commands:
  help        Help about any command
  scan        Run scan
  secrets     Run secrets
  sign        Sign supported file format
  verify      Verify signature of a signed file

Flags:
      --alerts-format string              Alerts format. Supported formats: coloredtable, table, text, csv, json. Default output to console. Supports multiformat. Example: 'coloredtable,csv>>csv.csv'  (default "coloredtable")
      --api_token string                  API token for integration with CodeScoring server (required if api_url is set)
      --api_url string                    CodeScoring server url (e.g. https://codescoring.mycompany.com) (required if api_token is set)
      --block-on-empty-result             Block on empty result
      --bom-format string                 Bom format. Supported formats: cyclonedx_v1_4_json,cyclonedx_v1_5_json,cyclonedx_v1_6_ext_json,cyclonedx_v1_6_json,cyclonedx_v1_7_json (default "cyclonedx_v1_6_json")
      --bom-path string                   Path for save bom file (default "bom.json")
      --bun-args string                   pass flags to 'bun install --lockfile-only'
      --bun-path string                   Path to bun for resolve (default "bun")
      --bun-resolve                       Enable resolve using bun
      --cg-lang string                    Language to parse call graph with. Supported languages: csharp,go,java,kotlin,python
      --cg-path string                    Path to call graph for vulnerability reachability analysis
      --cloud-resolve                     Activate cloud resolve
      --composer-args string              pass flags to 'composer install'
      --composer-path string              Path to composer for resolve (default "composer")
      --composer-resolve                  Enable resolve using composer
      --conda-args string                 pass flags to conda
      --conda-lock-path string            Path to conda-lock for resolve (default "conda-lock")
      --conda-resolve                     Enable resolve using conda-lock
      --config string                     Config file (default "codescoring-johnny-config.yaml")
      --create-project                    Create project in CodeScoring if not exists
      --create-project-group              Create group in CodeScoring if not exists
      --debug                             Output detailed log
      --dotnet-args string                pass flags to 'dotnet restore'
      --dotnet-path string                Path to dotnet for resolve (default "dotnet")
      --dotnet-resolve                    Enable resolve using dotnet
  -f, --format string                     Report format. Supported formats: coloredtable, table, text, junit, sarif, csv, gl-dependency-scanning-report, gl-code-quality-report. Default output to console. Supports multiformat. Example: 'coloredtable,junit>>junit.xml'  (default "coloredtable")
      --gdt-match string                  Section in gradle dependency tree for scan. By default - parse all sections
      --go-path string                    Path to go for resolve (default "go")
      --go-resolve                        Enable resolve using go
      --gradle-args string                pass flags to 'gradle dependencies'
      --gradle-path string                Path to gradle for resolve (default "./gradlew")
      --gradle-resolve                    Enable resolve using gradle
  -g, --group-vulnerabilities-by string   Group vulnerabilities by. Supported kinds 'vulnerability', 'affect' (default "vulnerability")
  -h, --help                              help for this command
      --ignore stringArray                Ignore paths (--ignore first --ignore "/**/onem?re")
      --ignores-format string             Displays the ignores of the specified project with formatting. Supported formats: coloredtable, table, text, csv, json. Default output to console. Supports multiformat. Example: 'coloredtable,csv>>csv.csv'  (default "coloredtable")
      --license string                    Project license code
      --localization string               Localization language (en|ru) (default "en")
      --maven-args string                 pass flags to 'mvn dependency:tree'
      --maven-path string                 Path to mvn for resolve (default "mvn")
      --maven-resolve                     Enable resolve using mvn
      --no-summary                        Do not print summary
      --no-wait                           No wait analysis results
      --npm-args string                   pass flags to 'npm install'
      --npm-path string                   Path to npm for resolve (default "npm")
      --npm-resolve                       Enable resolve using npm
      --only-hashes                       Search only for direct inclusion of dependencies using file hashes
      --pip-args string                   pass flags to 'pip freeze'
      --pip-path string                   Path to pip for resolve (default "pip")
      --pip-resolve                       Enable resolve using pip
      --pipdeptree-args string            pass flags to 'pipdeptree'
      --pipdeptree-path string            Path to pipdeptree for resolve (default "pipdeptree")
      --pipdeptree-resolve                Enable resolve using pipdeptree
      --pnpm-args string                  pass flags to 'pnpm install'
      --pnpm-path string                  Path to pnpm for resolve (default "pnpm")
      --pnpm-resolve                      Enable resolve using pnpm
      --poetry-args string                pass flags to 'poetry debug resolve'
      --poetry-path string                Path to poetry for resolve (default "poetry")
      --poetry-resolve                    Enable resolve using poetry
      --policy-ignores                    Displays the ignores
      --progress-bar string               Progress bar formats: spinner,text
      --project string                    Project name in CodeScoring
      --project-categories string         Category names for created project in CodeScoring (comma-separated list)
      --project-group string              Project group for created or added project in CodeScoring
      --project-proprietor string         Proprietor for created project in CodeScoring
      --python-version string             Python version
      --save-results                      Save results to CodeScoring. Used just together with project name
      --sbt-args string                   pass flags to 'sbt dependencyTree'
      --sbt-path string                   Path to sbt for resolve (default "sbt")
      --sbt-resolve                       Enable resolve using sbt
      --scan-archives                     Scan archives. Supported types: '.jar', '.rar', '.tar', '.tar.bz2', '.tbz2', '.tar.gz', '.tgz', '.tar.xz', '.txz', '.war', '.zip', '.aar', '.egg', '.hpi', '.nupkg', '.whl'
      --scan-depth int                    Archive scanning depth (default 1)
  -s, --sort-vulnerabilities-by string    Sort vulnerabilities by. Comma separated field names. For DESC - write field name with prefix '-'.
                                          FieldNames: 'vulnerability', 'fixedversion', 'cvss2', 'cvss3', 'cwes', 'links', 'affect' (default "-cvss3,-cvss2,fixedversion,vulnerability,cwes,links,affect")
      --stage string                      Policy stage (build, dev, source, stage, test, prod, proxy) (default "build")
      --swift-args string                 pass flags to 'swift build
      --swift-path string                 Path to swift for resolve (default "swift")
      --swift-resolve                     Enable resolve using swift
  -t, --timeout uint16                    Timeout of analysis results waiting in seconds (default 3600)
      --uv-args string                    pass flags to 'uv lock'
      --uv-path string                    Path to uv for resolve (default "uv")
      --uv-resolve                        Enable resolve using uv
  -v, --version                           version for this command
      --with-hashes                       Search for direct inclusion of dependencies using file hashes
      --yarn-args string                  pass flags to 'yarn install'
      --yarn-path string                  Path to yarn for resolve (default "yarn")
      --yarn-resolve                      Enable resolve using yarn
