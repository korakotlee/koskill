class Koskill < Formula
  desc "Universal developer tool and web dashboard for cross-agent skill and MCP synchronization"
  homepage "https://github.com/korakotlee/koskill"
  url "https://registry.npmjs.org/koskill/-/koskill-0.1.0.tgz"
  sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    output = shell_output("#{bin}/koskill --help")
    assert_match "Usage: koskill", output
  end
end
