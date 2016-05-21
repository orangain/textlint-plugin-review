# textlint-plugin-review [![Build Status](https://travis-ci.org/orangain/textlint-plugin-review.svg?branch=master)](https://travis-ci.org/orangain/textlint-plugin-review) [![npm version](https://badge.fury.io/js/textlint-plugin-review.svg)](https://badge.fury.io/js/textlint-plugin-review)

Add [Re:VIEW](https://github.com/kmuto/review) support for [textlint](https://github.com/textlint/textlint "textlint").

What is textlint plugin? Please see https://github.com/textlint/textlint/blob/master/docs/plugin.md


## Installation

    npm install textlint-plugin-review

## Usage

Manually add review plugin to your `.textlintrc` like:

```
{
    "plugins": [
        "review"
    ]
}
```

Lint Re:VIEW file with textlint:

```
$ textlint ch01.re
```

## Tests

    npm test

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

MIT
