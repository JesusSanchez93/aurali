import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Img,
  Hr,
} from '@react-email/components';

export interface EmailTheme {
  primaryColor: string;
  ctaColor: string;
  ctaTextColor: string;
  orgName: string;
  logoUrl?: string;
}

const DEFAULT_THEME: EmailTheme = {
  primaryColor: '#1E1B4B',
  ctaColor: '#F59E0B',
  ctaTextColor: '#111827',
  orgName: 'Aurali Legal',
};

interface WorkflowEmailProps {
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  subject?: string;
  theme?: Partial<EmailTheme>;
}

export function WorkflowEmail({
  bodyHtml,
  ctaUrl,
  ctaLabel,
  subject,
  theme,
}: WorkflowEmailProps) {
  const t: EmailTheme = { ...DEFAULT_THEME, ...theme };

  return (
    <Html lang="es">
      <Head />
      {subject && <Preview>{subject}</Preview>}
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Wordmark — small and quiet, not a colored letterhead banner */}
          <Section style={styles.header}>
            {t.logoUrl ? (
              <Img src={t.logoUrl} alt={t.orgName} height={22} style={styles.logo} />
            ) : (
              <Text style={{ ...styles.headerTitle, color: t.primaryColor }}>{t.orgName}</Text>
            )}
          </Section>

          {/* Body content */}
          <Section style={styles.content}>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {/* CTA button */}
          {ctaUrl && (
            <Section style={styles.ctaSection}>
              <Button
                href={ctaUrl}
                style={{
                  ...styles.button,
                  backgroundColor: t.ctaColor,
                  color: t.ctaTextColor,
                }}
              >
                {ctaLabel ?? 'Completar formulario'}
              </Button>
            </Section>
          )}

          {/* Footer */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              {t.orgName}
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#ffffff',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 0,
    margin: 0,
  },
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
  },
  header: {
    padding: '40px 8px 24px',
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.02em',
    margin: 0,
  },
  logo: {
    display: 'block',
  },
  content: {
    padding: '0 8px',
    fontSize: '15px',
    lineHeight: '1.65',
    color: '#1F2937',
  },
  ctaSection: {
    padding: '28px 8px 8px',
  },
  button: {
    fontWeight: '500',
    padding: '11px 22px',
    borderRadius: '6px',
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  footer: {
    padding: '20px 8px 40px',
  },
  divider: {
    borderTop: '1px solid #E5E7EB',
    margin: '32px 8px 0',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: '12px',
    margin: 0,
  },
};
