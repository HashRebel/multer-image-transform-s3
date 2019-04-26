module.exports = {
    'env': {
        'commonjs': true,
        'es6': true,
        'node': true,
        'mocha': true
    },
    'extends': 'eslint:recommended',
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly'
    },
    'parserOptions': {
        'ecmaVersion': 2018
    },
    "plugins": [
      "mocha"
    ],
    'rules': {
        'no-console': 'off',
        'indent': [
            'error',
            2
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ]
    },
    'overrides': [
      {
        'files': ['**/*.js'],
        'excludedFiles': '*.test.js',
      }
    ]
};