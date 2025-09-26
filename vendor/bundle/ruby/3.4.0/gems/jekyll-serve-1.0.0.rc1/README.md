# `jekyll serve`

The `jekyll serve` command.

## Installation

**`jekyll-serve` comes pre-installed with Jekyll 2.1 and higher**

Add this line to your application's Gemfile:

    gem 'jekyll-serve'

And then execute:

    $ bundle

Or install it yourself as:

    $ gem install jekyll-serve

## Usage

```bash
$ jekyll serve # boot up a server
$ jekyll serve --help # help for jekyll-serve
$ jekyll serve --watch # boot up a server which watches
$ jekyll serve --detach # boot up a server in the background
$ jekyll serve --port 3000 # change the port
$ jekyll serve --host parkermoo.re # change the host
$ jekyll serve --baseurl # change the baseurl (e.g. `/hi` of `http://localhost:4000/hi`) to which WEBrick mounts
$ jekyll serve --skip-initial-build # skips the site build, starts the server immediately. Useful with `--watch`.
```

With the exception of `--detach/-B` and `--watch/-w`, any of these commands can be used together.

## Contributing

1. Fork it ( https://github.com/jekyll/jekyll-serve/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
