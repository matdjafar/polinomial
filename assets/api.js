// Supabase API Client
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

const API = {
  call: async function(action, payload = {}) {
    if (action === 'getState') {
      let { data: pengData } = await supabase.from('arena_pengaturan').select('*').eq('id', 1).single();
      let { data: statusData } = await supabase.from('arena_status_soal').select('*');
      let { data: logData } = await supabase.from('arena_log_jawaban').select('kelompok, is_benar, poin_didapat');
      
      // Hitung skor per kelompok
      let skorMap = {};
      (logData || []).forEach(log => {
         if (log.is_benar) {
            if (!skorMap[log.kelompok]) skorMap[log.kelompok] = 0;
            skorMap[log.kelompok] += log.poin_didapat;
         }
      });
      let skorKelompok = Object.keys(skorMap).map(k => ({ kelompok: k, poin: skorMap[k] }));
      
      // Default pengaturan mock
      let modeKunci = 'PER_KELOMPOK';
      
      return {
        pengaturan: {
          bukaAkses: pengData ? pengData.buka_akses : true,
          tampilPembahasan: pengData ? pengData.tampil_pembahasan : false,
          tampilSkor: true,
          modeKunci: modeKunci,
          targetPoin: 2000,
          paketAktif: 1
        },
        skorKelompok: skorKelompok,
        statusSoal: (statusData || []).map(row => {
          let st = row.status;
          if (st === 'selesai') st = 'terjawab';
          if (st === 'salah') st = 'hangus';
          return {
            key: modeKunci === 'GLOBAL' ? row.paket + '_' + row.id_soal + '_GLOBAL' : row.paket + '_' + row.id_soal + '_' + row.kelompok,
            paket: row.paket,
            idSoal: row.id_soal,
            kelompok: row.kelompok,
            nama: row.nama,
            status: st
          };
        })
      };
    }
    
    if (action === 'bukaSoal') {
      await supabase.from('arena_status_soal')
            .delete()
            .match({ paket: payload.paket, id_soal: payload.idSoal, kelompok: payload.kelompok });
            
      let { error } = await supabase.from('arena_status_soal').insert([{
        paket: payload.paket,
        id_soal: payload.idSoal,
        kelompok: payload.kelompok,
        nama: payload.nama,
        status: 'dikerjakan'
      }]);
      if (error) throw new Error(error.message);
      return { success: true };
    }
    
    if (action === 'lepasSoal') {
      await supabase.from('arena_status_soal')
            .delete()
            .match({ paket: payload.paket, id_soal: payload.idSoal, kelompok: payload.kelompok, status: 'dikerjakan' });
      return { success: true };
    }
    
    if (action === 'kirimJawaban') {
      let statusStr = payload.isBenar ? 'selesai' : 'salah';
      let finalPoin = payload.isBenar ? payload.poinLevel : 0;
      
      await supabase.from('arena_status_soal')
            .delete()
            .match({ paket: payload.paket, id_soal: payload.idSoal, kelompok: payload.kelompok });
            
      await supabase.from('arena_status_soal').insert([{
        paket: payload.paket,
        id_soal: payload.idSoal,
        kelompok: payload.kelompok,
        nama: payload.nama,
        status: statusStr
      }]);
      
      await supabase.from('arena_log_jawaban').insert([{
        kelompok: payload.kelompok,
        nama: payload.nama,
        paket: payload.paket,
        id_soal: payload.idSoal,
        jawaban_teks: payload.jawabanTeks,
        is_benar: payload.isBenar,
        poin_didapat: finalPoin
      }]);
      
      return { success: true };
    }
    
    if (action === 'updatePengaturan') {
      await supabase.from('arena_pengaturan')
            .update({ buka_akses: payload.bukaAkses, tampil_pembahasan: payload.tampilPembahasan })
            .eq('id', 1);
      return { success: true };
    }
    
    if (action === 'resetData') {
      await supabase.from('arena_status_soal').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('arena_log_jawaban').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return { success: true };
    }
    
    if (action === 'getRekap') {
      let { data: statusData } = await supabase.from('arena_status_soal').select('*');
      let { data: logData } = await supabase.from('arena_log_jawaban').select('*').order('waktu', { ascending: false });
      
      return {
        statusSoal: (statusData || []).map(row => ({
          paket: row.paket,
          idSoal: row.id_soal,
          kelompok: row.kelompok,
          nama: row.nama,
          status: row.status === 'selesai' ? 'terjawab' : (row.status === 'salah' ? 'hangus' : row.status)
        })),
        logJawaban: (logData || []).map(row => ({
          waktu: row.waktu,
          kelompok: row.kelompok,
          nama: row.nama,
          paket: row.paket,
          idSoal: row.id_soal,
          jawabanTeks: row.jawaban_teks,
          isBenar: row.is_benar,
          poinDidapat: row.poin_didapat
        }))
      };
    }
    
    throw new Error("Action tidak dikenal.");
  }
};
