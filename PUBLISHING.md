# Publishing @desicon/seal-cdn

Configure npm trusted publishing for GitHub owner `Desicon-AI`, repository `seal-cdn`, workflow `publish-npm.yml`, environment `npm`, with direct publishing enabled. If the package has not been created on npm, perform its first publication with an authenticated package owner, then configure the trusted publisher.

Run Publish npm package on main with publish=false to test and build the package artifact. After checking the version is unused, run with publish=true. Only seal.js and README.md (plus npm-required metadata) are packaged. No stored npm token is needed for subsequent trusted publishing. Main pushes do not publish automatically.
