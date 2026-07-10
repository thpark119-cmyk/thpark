import re

with open('src/components/Metronome.tsx', 'r') as f:
    content = f.read()

target = """          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{t('metronome.timeSignature')}</p>
            <div className="flex items-center gap-2 bg-stone-800/50 p-1 rounded-xl relative">
              <select 
                value={`${settings.numerator}/${settings.denominator}`}
                onChange={(e) => {
                  const [num, den] = e.target.value.split('/').map(Number);
                  updateTimeSignature(num, den);
                }}
                className="bg-transparent text-white font-bold outline-none text-center appearance-none px-4 py-1 cursor-pointer w-full"
              >
                {!STANDARD_TIME_SIGNATURES.includes(`${settings.numerator}/${settings.denominator}`) && (
                  <option value={`${settings.numerator}/${settings.denominator}`} className="bg-stone-900">
                    {settings.numerator}/{settings.denominator} ({t('metronome.custom') || 'Custom'})
                  </option>
                )}
                {STANDARD_TIME_SIGNATURES.map(ts => (
                  <option key={ts} value={ts} className="bg-stone-900">{ts}</option>
                ))}
              </select>
            </div>
          </div>"""

replacement = """          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{t('metronome.timeSignature')}</p>
            <p className="text-sm font-bold text-white tracking-widest">{t('metronome.currentTimeSignature') || '현재 박자'}: {settings.numerator}/{settings.denominator}</p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{t('metronome.commonTimeSignatures') || '자주 쓰는 박자'}</p>
            <div className="flex flex-wrap gap-2">
              {STANDARD_TIME_SIGNATURES.map(ts => (
                <button
                  key={ts}
                  onClick={() => {
                    const [num, den] = ts.split('/').map(Number);
                    updateTimeSignature(num, den);
                  }}
                  className={`min-h-[40px] px-4 rounded-xl font-bold transition-all text-sm ${
                    `${settings.numerator}/${settings.denominator}` === ts
                      ? 'bg-brand text-stone-950 shadow-lg shadow-brand/20'
                      : 'bg-stone-800/50 text-stone-300 hover:bg-stone-700 hover:text-white border border-white/5'
                  }`}
                >
                  {ts}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">{t('metronome.customTimeSignature') || '박자 직접 입력'}</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-500 font-medium">{t('metronome.numerator') || '분자'}</label>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={customNumerator}
                      onChange={(e) => setCustomNumerator(e.target.value)}
                      className="w-16 min-h-[40px] bg-stone-800/50 border border-white/5 rounded-xl text-center text-white font-bold outline-none focus:border-brand/50 transition-colors"
                      placeholder="4"
                    />
                  </div>
                  <span className="text-stone-500 text-xl font-light mb-1">/</span>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-stone-500 font-medium">{t('metronome.denominator') || '분모'}</label>
                    <select
                      value={customDenominator}
                      onChange={(e) => setCustomDenominator(e.target.value)}
                      className="w-16 min-h-[40px] bg-stone-800/50 border border-white/5 rounded-xl text-center text-white font-bold outline-none focus:border-brand/50 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="8">8</option>
                      <option value="16">16</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const num = parseInt(customNumerator);
                    const den = parseInt(customDenominator);
                    if (isNaN(num) || num < 1 || num > 16 || isNaN(den) || ![2, 4, 8, 16].includes(den)) {
                      alert(`${t('metronome.invalidTimeSignature')} \n${t('metronome.invalidTimeSignatureDesc')}`);
                      return;
                    }
                    updateTimeSignature(num, den);
                  }}
                  className="min-h-[40px] px-4 bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white rounded-xl font-bold transition-all text-sm border border-white/5"
                >
                  {t('metronome.apply') || '적용'}
                </button>
              </div>
            </div>
          </div>"""

content = content.replace(target, replacement)

with open('src/components/Metronome.tsx', 'w') as f:
    f.write(content)
