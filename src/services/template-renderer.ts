// src/services/template-renderer.ts
// Mustache-style template rendering with strict variable validation

import type { PrismaClient } from "@prisma/client";

interface RenderContext {
  tenant?: Record<string, any>;
  client?: Record<string, any>;
  animal?: Record<string, any>;
  litter?: Record<string, any>;
  invoice?: Record<string, any>;
  breeder?: Record<string, any>;
  [key: string]: any;
}

const ALLOWED_NAMESPACES = [
  "tenant",
  "client",
  "animal",
  "litter",
  "invoice",
  "breeder",
];

/**
 * Extract variable references from template text
 * Matches {{variableName}} or {{namespace.field}}
 */
function extractVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Validate that all template variables are in allowed namespaces
 */
function validateVariables(variables: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const v of variables) {
    const parts = v.split(".");
    const namespace = parts[0];

    if (!ALLOWED_NAMESPACES.includes(namespace)) {
      errors.push(`Unknown variable namespace: ${v}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Render a simple mustache-style template
 * Supports {{namespace.field}} syntax only
 * No conditionals, loops, or helpers
 */
function renderMustache(text: string, context: RenderContext): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
    const path = varPath.trim();
    const parts = path.split(".");

    let value: any = context;
    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = value[part];
      } else {
        return "";
      }
    }

    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  });
}

/**
 * Validate template content before storing
 */
export async function validateTemplate(params: {
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
}): Promise<{ valid: boolean; errors: string[] }> {
  const allText = [
    params.subject || "",
    params.bodyText,
    params.bodyHtml || "",
  ].join(" ");

  const variables = extractVariables(allText);
  return validateVariables(variables);
}

/**
 * Render a template by ID with provided context
 */
export async function renderTemplate(params: {
  prisma: PrismaClient;
  templateId: number;
  context: RenderContext;
}): Promise<{
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
}> {
  const { prisma, templateId, context } = params;

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { content: true },
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  if (template.content.length === 0) {
    throw new Error(`Template has no content: ${templateId}`);
  }

  const content = template.content[0];

  return {
    subject: content.subject ? renderMustache(content.subject, context) : undefined,
    bodyText: renderMustache(content.bodyText, context),
    bodyHtml: content.bodyHtml ? renderMustache(content.bodyHtml, context) : undefined,
  };
}

/**
 * Render template content directly without fetching from DB
 */
export function renderTemplateContent(params: {
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  context: RenderContext;
}): {
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
} {
  const { subject, bodyText, bodyHtml, context } = params;

  return {
    subject: subject ? renderMustache(subject, context) : undefined,
    bodyText: renderMustache(bodyText, context),
    bodyHtml: bodyHtml ? renderMustache(bodyHtml, context) : undefined,
  };
}
