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
  /** Subtle brand accent — used sparingly for the top bar, links and CTA. */
  accentColor: string;
  ctaColor: string;
  ctaTextColor: string;
  orgName: string;
  logoUrl?: string;
}

const DEFAULT_THEME: EmailTheme = {
  primaryColor: '#1E1B4B',
  accentColor: '#7C3AED',
  ctaColor: '#7C3AED',
  ctaTextColor: '#ffffff',
  orgName: 'Aurali Legal',
  logoUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://aurali.app'}/aurali-logo.png`,
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
      <Head>
        <style>{`
          .aurali-email-body a { color: ${t.accentColor}; text-decoration: underline; }
        `}</style>
      </Head>
      {subject && <Preview>{subject}</Preview>}
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Slim top accent bar — the one deliberate spot of color on an otherwise quiet card.
              Lives inside the rounded, overflow-hidden container so its top corners clip too. */}
          <div style={{ ...styles.topBar, backgroundColor: t.accentColor }} />

          {/* Wordmark — small and quiet, not a colored letterhead banner */}
          <Section style={styles.header}>
            {t.logoUrl ? (
              <Img src={t.logoUrl} alt={t.orgName} height={28} style={styles.logo} />
            ) : (
              <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: 8 }}>
                      <div style={{ ...styles.wordmarkDot, backgroundColor: t.accentColor }} />
                    </td>
                    <td>
                      <Text style={{ ...styles.headerTitle, color: t.primaryColor }}>{t.orgName}</Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </Section>

          {/* Body content */}
          <Section style={styles.content}>
            <div className="aurali-email-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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
          <Hr style={{ ...styles.divider, borderTopColor: `${t.accentColor}26` }} />
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
    backgroundColor: '#F4F4F6',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: '40px 20px',
    margin: 0,
  },
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #ECECEF',
    boxShadow: '0 1px 3px rgba(17, 24, 39, 0.04), 0 8px 24px rgba(17, 24, 39, 0.06)',
    overflow: 'hidden',
  },
  topBar: {
    height: '3px',
    width: '100%',
  },
  header: {
    padding: '32px 32px 20px',
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.02em',
    margin: 0,
  },
  wordmarkDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },
  logo: {
    display: 'block',
  },
  content: {
    padding: '0 32px',
    fontSize: '15px',
    lineHeight: '1.65',
    color: '#1F2937',
  },
  ctaSection: {
    padding: '28px 32px 4px',
  },
  button: {
    fontWeight: '600',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  footer: {
    padding: '20px 32px 32px',
  },
  divider: {
    borderTop: '1px solid #E5E7EB',
    margin: '32px 32px 0',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: '12px',
    margin: 0,
  },
};
