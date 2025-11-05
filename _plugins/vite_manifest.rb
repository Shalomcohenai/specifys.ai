module Jekyll
  # Liquid filter to get Vite bundle paths
  module ViteManifestFilter
    def vite_bundle(input, type = 'js')
      bundle_name = input.to_s
      manifest_path = File.join(Dir.pwd, 'assets', 'dist', '.vite', 'manifest.json')
      
      # Return nil if manifest doesn't exist (fallback to original)
      return nil unless File.exist?(manifest_path)
      
      begin
        manifest = JSON.parse(File.read(manifest_path))
        
        # Look for bundle entry points
        bundle_key = "assets/#{type}/bundles/#{bundle_name}.#{type == 'js' ? 'js' : 'css'}"
        
        manifest.each do |key, value|
          if value.is_a?(Hash) && value['isEntry']
            # Check if this is the bundle we're looking for
            if key == bundle_key || 
               key.include?("bundles/#{bundle_name}") || 
               (value['name'] && value['name'] == bundle_name)
              
              file_path = value['file']
              # Ensure it starts with js/ or css/
              if file_path.start_with?('js/') || file_path.start_with?('css/')
                return "/assets/dist/#{file_path}"
              else
                return "/assets/dist/#{type}/#{file_path}"
              end
            end
          end
        end
        
        nil
      rescue JSON::ParserError, Errno::ENOENT => e
        Jekyll.logger.warn("ViteManifest", "Failed to parse manifest: #{e.message}")
        nil
      end
    end
  end
  
  # Liquid tag to output bundle link/script tags
  class ViteBundleTag < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      super
      @params = markup.strip.split(/\s+/)
      @bundle_name = @params[0]
      @type = @params[1] || 'js'
    end
    
    def render(context)
      bundle_name = Liquid::Template.parse(@bundle_name).render(context)
      type = Liquid::Template.parse(@type).render(context)
      
      manifest_path = File.join(Dir.pwd, 'assets', 'dist', '.vite', 'manifest.json')
      
      # Return empty if manifest doesn't exist (development mode)
      return '' unless File.exist?(manifest_path)
      
      begin
        manifest = JSON.parse(File.read(manifest_path))
        
        # Look for bundle entry points
        # Try both with and without "bundles/" prefix
        bundle_key_bundles = "assets/#{type}/bundles/#{bundle_name}.#{type == 'js' ? 'js' : 'css'}"
        bundle_key_direct = "assets/#{type}/#{bundle_name}.#{type == 'js' ? 'js' : 'css'}"
        
        manifest.each do |key, value|
          if value.is_a?(Hash) && value['isEntry']
            # Skip legacy bundles
            next if key.include?('-legacy') || value['file'].include?('-legacy')
            
            # Check if this is the bundle we're looking for
            if key == bundle_key_bundles || 
               key == bundle_key_direct ||
               (key.include?("bundles/#{bundle_name}") && !key.include?('-legacy')) ||
               (key.end_with?("/#{bundle_name}.#{type == 'js' ? 'js' : 'css'}") && !key.include?('-legacy')) ||
               (value['name'] && value['name'] == bundle_name)
              
              file_path = value['file']
              
              if type == 'css'
                return "<link rel=\"stylesheet\" href=\"/assets/dist/#{file_path}\">"
              else
                return "<script src=\"/assets/dist/#{file_path}\"></script>"
              end
            end
          end
        end
        
        ''
      rescue JSON::ParserError, Errno::ENOENT => e
        Jekyll.logger.warn("ViteManifest", "Failed to parse manifest: #{e.message}")
        ''
      end
    end
  end
end

Liquid::Template.register_filter(Jekyll::ViteManifestFilter)
Liquid::Template.register_tag('vite_bundle', Jekyll::ViteBundleTag)
