---
layout: default
title: Blog
description: AI-powered development tools and insights
---

<div class="blog-index">
    <h1>Blog</h1>
    
    <ul class="post-list">
        {% for post in site.posts %}
        <li class="post-item">
            <h2 class="post-item-title">
                <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
            </h2>
            
            <div class="post-item-meta">
                <time datetime="{{ post.date | date_to_xmlschema }}" class="post-item-date">
                    {{ post.date | date: "%B %d, %Y" }}
                </time>
                
                {% if post.author %}
                <span class="post-item-author">by {{ post.author }}</span>
                {% endif %}
                
                {% if post.tags %}
                <div class="post-item-tags">
                    {% for tag in post.tags limit: 3 %}
                    <span class="tag">{{ tag }}</span>
                    {% endfor %}
                </div>
                {% endif %}
            </div>
            
            {% if post.description %}
            <p class="post-item-excerpt">{{ post.description }}</p>
            {% endif %}
            
            <a href="{{ post.url | relative_url }}" class="post-item-read-more">
                Read more →
            </a>
        </li>
        {% endfor %}
    </ul>
</div>
