interface NextStepsProps {
  steps: Array<{ icon?: string; title?: string; description?: string }>;
}

const iconMap: Record<string, string> = {
  payment: '💳',
  phone: '📞',
  calendar: '📅',
  email: '📧',
};

function getIcon(icon?: string): string {
  if (!icon) return '📋';
  return iconMap[icon] || '📋';
}

export function NextSteps({ steps }: NextStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div>
      <h2 style={{ fontFamily: 'serif', fontSize: '22px', color: '#1a1a2e', margin: '0 0 20px 0' }}>
        O que acontece a seguir?
      </h2>

      {/* Desktop: horizontal row */}
      <div className="he-nextsteps-desktop">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  maxWidth: '180px',
                }}
              >
                <span style={{ fontSize: '28px', marginBottom: '8px' }}>
                  {getIcon(step.icon)}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#1a1a2e',
                    marginBottom: '4px',
                  }}
                >
                  {step.title}
                </span>
                <span style={{ fontSize: '13px', color: '#718096' }}>
                  {step.description}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  style={{
                    fontSize: '20px',
                    color: '#cbd5e0',
                    margin: '8px 16px 0 16px',
                    alignSelf: 'flex-start',
                  }}
                >
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: vertical stack */}
      <div className="he-nextsteps-mobile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>{getIcon(step.icon)}</span>
              <div>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#1a1a2e',
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  {step.title}
                </span>
                <span style={{ fontSize: '13px', color: '#718096' }}>
                  {step.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 600px) {
          .he-nextsteps-desktop { display: block; }
          .he-nextsteps-mobile { display: none; }
        }
        @media (max-width: 599px) {
          .he-nextsteps-desktop { display: none; }
          .he-nextsteps-mobile { display: block; }
        }
      `}</style>
    </div>
  );
}
