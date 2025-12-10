#!/usr/bin/env ruby
require 'jekyll'
require 'fileutils'

# Simple Jekyll compilation for specific pages
Jekyll::Hooks.register :site, :after_init do |site|
  puts "Compiling pages..."
end

# Compile specific pages manually
def compile_page(source, dest, layout_content)
  content = File.read(source)
  
  # Extract front matter
  if content =~ /\A(---\s*\n.*?\n?)(---\s*\n?)(.*)/m
    front_matter = $1 + $2
    body = $3
    
    # Read layout
    layout_file = File.join('_layouts', 'default.html')
    if File.exist?(layout_file)
      layout = File.read(layout_file)
      
      # Replace {{ content }} with page content
      html = layout.gsub('{{ content }}', body)
      
      # Simple variable replacement (basic)
      html = html.gsub('{{ page.title }}', extract_title(front_matter))
      html = html.gsub('{{ page.description }}', extract_description(front_matter) || '')
      
      # Write compiled file
      FileUtils.mkdir_p(File.dirname(dest))
      File.write(dest, html)
      puts "Compiled: #{source} -> #{dest}"
    end
  end
end

def extract_title(front_matter)
  if front_matter =~ /title:\s*["']?([^"'\n]+)["']?/
    $1.strip
  else
    'Specifys.ai'
  end
end

def extract_description(front_matter)
  if front_matter =~ /description:\s*["']?([^"'\n]+)["']?/
    $1.strip
  else
    nil
  end
end

# Try to use Jekyll properly
begin
  config = Jekyll.configuration({
    'source' => '.',
    'destination' => '_site',
    'skip_initial_build' => false
  })
  
  site = Jekyll::Site.new(config)
  site.process
  puts "Jekyll build completed!"
rescue => e
  puts "Jekyll build failed: #{e.message}"
  puts "Falling back to manual compilation..."
  
  # Manual compilation fallback
  pages_to_compile = [
    ['blog/index.html', '_site/blog/index.html'],
    ['pages/academy/index.html', '_site/academy.html'],
    ['pages/article.html', '_site/article.html'],
    ['tools/map/vibe-coding-tools-map.html', '_site/tools/map/vibe-coding-tools-map.html']
  ]
  
  pages_to_compile.each do |source, dest|
    if File.exist?(source)
      compile_page(source, dest, nil)
    end
  end
end

