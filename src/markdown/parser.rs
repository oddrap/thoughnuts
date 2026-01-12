use anyhow::Result;
use pulldown_cmark::{html, CodeBlockKind, Event, Options, Parser, Tag, TagEnd};
use syntect::highlighting::ThemeSet;
use syntect::html::highlighted_html_for_string;
use syntect::parsing::SyntaxSet;

pub struct MarkdownParser {
    syntax_set: SyntaxSet,
    theme_set: ThemeSet,
}

impl Default for MarkdownParser {
    fn default() -> Self {
        Self::new()
    }
}

impl MarkdownParser {
    pub fn new() -> Self {
        Self {
            syntax_set: SyntaxSet::load_defaults_newlines(),
            theme_set: ThemeSet::load_defaults(),
        }
    }

    pub fn parse(&self, markdown: &str) -> Result<String> {
        let options = Options::all();
        let parser = Parser::new_ext(markdown, options);

        let mut in_code_block = false;
        let mut code_lang = String::new();
        let mut code_content = String::new();

        let mut events: Vec<Event> = Vec::new();

        for event in parser {
            match event {
                Event::Start(Tag::CodeBlock(kind)) => {
                    in_code_block = true;
                    code_lang = match kind {
                        CodeBlockKind::Fenced(lang) => lang.to_string(),
                        CodeBlockKind::Indented => String::new(),
                    };
                    code_content.clear();
                }
                Event::End(TagEnd::CodeBlock) => {
                    in_code_block = false;
                    let highlighted = self.highlight_code(&code_content, &code_lang);
                    events.push(Event::Html(highlighted.into()));
                }
                Event::Text(text) if in_code_block => {
                    code_content.push_str(&text);
                }
                _ => {
                    events.push(event);
                }
            }
        }

        let mut html_output = String::new();
        html::push_html(&mut html_output, events.into_iter());

        Ok(html_output)
    }

    fn highlight_code(&self, code: &str, lang: &str) -> String {
        let lang = if lang.is_empty() { "txt" } else { lang };

        let syntax = self
            .syntax_set
            .find_syntax_by_token(lang)
            .unwrap_or_else(|| self.syntax_set.find_syntax_plain_text());

        let theme = &self.theme_set.themes["base16-ocean.dark"];

        match highlighted_html_for_string(code, &self.syntax_set, syntax, theme) {
            Ok(html) => format!(
                r#"<div class="code-block"><pre><code class="language-{}">{}</code></pre></div>"#,
                lang, html
            ),
            Err(_) => format!(
                r#"<div class="code-block"><pre><code class="language-{}">{}</code></pre></div>"#,
                lang,
                html_escape::encode_text(code)
            ),
        }
    }
}

pub fn parse_frontmatter(content: &str) -> Result<(crate::models::post::PostFrontmatter, String)> {
    let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
    let result = matter.parse(content);

    let frontmatter: crate::models::post::PostFrontmatter = result
        .data
        .ok_or_else(|| anyhow::anyhow!("No frontmatter found"))?
        .deserialize()?;

    Ok((frontmatter, result.content))
}
