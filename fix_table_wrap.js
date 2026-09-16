const fs = require('fs');

const usersPagePath = 'D:\\Mohosin\\projects\\dashboard\\culture_dash\\app\\(dashboard)\\users\\page.tsx';

if (fs.existsSync(usersPagePath)) {
  let content = fs.readFileSync(usersPagePath, 'utf8');

  // Replace Table element
  content = content.replace(
    '<table className="w-full text-left">',
    '<table className="w-full text-left whitespace-nowrap min-w-[950px]">'
  );

  // Replace Name TD block
  const oldNameTd = `<td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={\`w-10 h-10 rounded-full \${user.color || 'bg-blue-500'} flex items-center justify-center text-white font-bold\`}>
                        {user.name ? user.name.charAt(0) : "U"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">{user.name}</span>
                        {user.isCelebrity && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Sparkles size={10} className="fill-amber-400" /> VIP
                          </span>
                        )}
                      </div>
                    </div>
                  </td>`;

  const newNameTd = `<td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className={\`w-10 h-10 rounded-full \${user.color || 'bg-blue-600'} flex items-center justify-center text-white font-bold shadow-sm\`}>
                          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        {user.isCelebrity && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-black ring-2 ring-[#111111]" title="Celebrity / VIP">
                            <Sparkles size={9} className="fill-black" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-base text-zinc-100">{user.name}</span>
                        {user.isCelebrity && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Sparkles size={10} className="fill-amber-400" /> VIP
                          </span>
                        )}
                      </div>
                    </div>
                  </td>`;

  content = content.replace(oldNameTd, newNameTd);

  fs.writeFileSync(usersPagePath, content, 'utf8');
  console.log('Fixed whitespace-nowrap and min-w in users/page.tsx');
}
