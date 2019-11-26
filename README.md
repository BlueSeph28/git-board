# git-board

```
  Usage: main -u <github-user> -r <github-repo> [-g github-token] -k <trello-key> -t <trello-token> -b <trello-board> [KEYWORDS...]

Options:
  -V, --version                     output the version number
  -e, --env <file>                  Get environment variables from a file
  -p, --password <password>         Password for environtment file
  -u, --github-user <user>          Github user or organization hosting the repository
  -r, --github-repo <repo>          Github repository name
  -m, --milestone-name <milestone>  Milestone to syncronize
  -l, --in-progress-label <label>   Label for in progress issue identify - Default: In Progress
  -g, --github-token <repo>         optional Github OAuth2 token
  -k, --trello-key <key>            Trello key
  -t, --trello-token <token>        Trello auth token
  -b, --trello-board <id>           Trello board ID
  -p, --include-pull-requests       Include pull requests
  -f, --full-text                   Reproduce full issue text on trello
  -c, --create-config <name>        Create config file specifying name
  -n, --no-commit                   Download and calculate modifications but do not write them to Trello
  -w, --warn <KEYWORD>              Warn about mentions of KEYWORD (default: [])
  -h, --help                        output usage information
```

The repository where to get the issues is specified with `-u` and `-r`.

The GitHub token is needed to access private repositories or repositories.

Keywords are what to search for to decide if a new issue should be imported. A label for each keyword will be created in trello.

## How to get Trello Key

https://trello.com/1/appKey/generate

## How to get Trello Token

Use the key from above in:

https://trello.com/1/authorize?key=_Key_here_&name=Issue+Importer+Prototype&response_type=token&scope=read,write&expiration=never

## How to get Github Token

https://github.com/settings/tokens

To do

- Sync deleted labels