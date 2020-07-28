# AVÖV Projekt Webseite

This repo contains the interactive visualization website for AVÖV/AVOEV, available at https://avoev-vsp.github.io.

This README details build instructions for the website itself.

## Project pre-requisites

The site uses npm and yarn, and was developed using VS Code.

- You should install VS Code, npm, and yarn first.
- All code is TypeScript and shall remain so.

The following VS Code plugins are used: search for and add these plugins in the left-nav plugin pane
in VS Code.

- `Prettier` to force code style consistency. Set VS Code to run Prettier automatically on file
  save.
- `Vetur`, for Vuejs support. This site is a [Vue](https://vuejs.org) SPA.
- `Shader languages support` for syntax highlighting in the WebGL vertex and fragment shader code

## Foundational technologies

You will need to know this tech in order to hack on this website:

- [TypeScript](https://typescriptlang.org) - typesafe JavaScript
- [Vue](https://vuejs.org) - the glue that connects UI elements to code. Similar to React but lightweight and awesome
- [Pug](https://pugjs.org) - the template language used in Vue files. Pug uses Python-style indentation instead of open/close XML tags, which makes it far easier to read than bare HTML.
- [ThreeJS](https://threejs.org) - WebGL library for the fancy animations.

## First time install

One line fetches everything from the npm database:

```
yarn install
```

## Development Commands

### Compiling and hot-reloads during development

This command runs a local server with hot reload for testing, usually listens on http://localhost:8080

```
yarn serve
```

### Compiles and minifies for production

```
yarn build
```

### Run your unit tests

Well... I have not written tests but the infrastructure is there to use `jest`.

```
yarn test:unit
```

### Pushing to the live site

Travis-CI is configured to automatically build the site with **every push to master**, so don't push to master until you are ready for your code to go live.

- Travis config is in `.travis.yml`

## Project Layout

- `/src`: all TypeScript and Vue files go here
- `/src/assets`: images, .csvs, etc that get packaged by webpack
- `/src/components`: shared Vue components go here
- `/src/plugins`: each visualization plugin is stored in a subfolder here. see
  /src/plugins/PLUGINS_README.md for more info on writing your own plugins!
- `/src/views`: Page views such as the front page.
- `/scripts`: Python scripts go here, which are used for preprocessing EpiSim results
- `/public`: These files are pushed as-is by webpack, in the root of the site. Thus everything in
  this folder is pushed to the root '/' folder. i.e. they are not packaged in any way

## Thank you!

Good luck and thanks for the help! -- [Billy](https://github.com/billyc)
